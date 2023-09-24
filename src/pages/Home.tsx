import { iconDownload } from "@gazatu/solid-spectre/icons/iconDownload"
import { iconRefreshCw } from "@gazatu/solid-spectre/icons/iconRefreshCw"
import { iconFolder } from "@gazatu/solid-spectre/icons/iconFolder"
import { iconBookOpen } from "@gazatu/solid-spectre/icons/iconBookOpen"
import { Button } from "@gazatu/solid-spectre/ui/Button"
import { Column } from "@gazatu/solid-spectre/ui/Column"
import { Form } from "@gazatu/solid-spectre/ui/Form"
import { Icon } from "@gazatu/solid-spectre/ui/Icon"
import { Input } from "@gazatu/solid-spectre/ui/Input"
import { Navbar } from "@gazatu/solid-spectre/ui/Navbar"
import { Progress } from "@gazatu/solid-spectre/ui/Progress"
import { Section } from "@gazatu/solid-spectre/ui/Section"
import { Select } from "@gazatu/solid-spectre/ui/Select"
import { Toaster } from "@gazatu/solid-spectre/ui/Toaster"
import { createStorageSignal } from "@solid-primitives/storage"
import { ResponseType, fetch } from "@tauri-apps/api/http"
import { platform } from "@tauri-apps/api/os"
import { downloadDir } from "@tauri-apps/api/path"
import { Command, open } from "@tauri-apps/api/shell"
import * as dialog from "@tauri-apps/api/dialog"
import { Component, ComponentProps, For, createEffect, createSignal } from "solid-js"
import { writeFile } from "../lib/tauri-plugin-fs"

const selectableQualities = ["audio", "1440p", "1080p", "720p"] as const

type YTVideoFormat = {
  id: string,
  format: string,
  resolution: string,
  fps: string,
}

const listYTVideoFormats = async (url: URL) => {
  const formats = [] as YTVideoFormat[]

  const command = Command.sidecar("bin/yt-dlp", [
    "--no-playlist", "--quiet", "--list-formats", url.href,
  ])

  const { code, stdout, stderr } = await command.execute()
  if (code !== 0) {
    throw new Error(stderr)
  }

  const formatsRegex = /(\w+)\s+(\w+)\s+(audio only|\d+x\d+)\s+(\d+)\s+(\d+\s+|)/gm
  let formatsMatch
  while ((formatsMatch = formatsRegex.exec(stdout)) !== null) {
    if (formatsMatch.index === formatsRegex.lastIndex) {
      formatsRegex.lastIndex++
    }

    const [, id, format, resolution, fps] = formatsMatch
    formats.push({ id, format, resolution, fps })
  }

  const videoOnly = formats.filter(f => f.resolution !== "audio only")
  const audioOnly = formats.filter(f => f.resolution === "audio only")

  return {
    videoOnly,
    audioOnly,
  }
}

type YTDLPDownloadOptions = {
  url: URL
  output: string
  type: "audio" | "1440p" | "1080p" | "720p"
  fileFormat?: string
  subtitles?: string
}

const downloadYTVideo = async (options: YTDLPDownloadOptions) => {
  const { url, output, type, fileFormat, subtitles } = options

  const formats = await listYTVideoFormats(url)

  const ytdlpArgs = ["--no-playlist", "--concurrent-fragments", "4"]
  if (type === "audio") {
    const bestAudio = formats.audioOnly[formats.audioOnly.length - 1]

    ytdlpArgs.push("--format", bestAudio.id, "--extract-audio", "--audio-format", "mp3", "--audio-quality", "0")
  } else {
    let quality = type

    let selectedFormats = [] as (typeof formats)["videoOnly"][number][]
    while (selectedFormats.length === 0) {
      const resolution = quality.replace("p", "")
      selectedFormats = formats.videoOnly.filter(f => f.resolution.includes(resolution))

      switch (quality) {
        case "1440p":
          quality = "1080p"
          break
        case "1080p":
          quality = "720p"
          break
      }
    }

    const bestVideo = selectedFormats[selectedFormats.length - 1]
    const bestAudio = formats.audioOnly[formats.audioOnly.length - 1]

    ytdlpArgs.push("--format", `${bestVideo.id}+${bestAudio.id}`)

    if (subtitles) {
      ytdlpArgs.push("--write-sub", "--write-auto-sub", "--sub-lang", `${subtitles}.*`)
    }
  }

  ytdlpArgs.push("-o", output, url.href)

  const command = Command.sidecar("bin/yt-dlp", ytdlpArgs)

  const { code, stderr } = await command.execute()
  if (code !== 0) {
    throw new Error(stderr)
  }
}

type ProgressToast = {
  value: number
  max: number
  text: string
}

const ProgressToast: Component<ProgressToast> = props => {
  return (
    <div>
      <div>
        <Progress value={props.value} max={props.max} />
      </div>
      <p>{props.text}</p>
      {/* <p>{estimatedEndText}</p> */}
    </div>
  )
}

const HomeView: Component = () => {
  const [downloading, setDownloading] = createSignal(false)
  const [urlList, setURLList] = createSignal("")
  const [selectedQuality, setSelectedQuality] = createStorageSignal<(typeof selectableQualities)[number]>("SELECTED_QUALITY", "audio")
  const [selectedSubtitles, setSelectedSubtitles] = createStorageSignal("SELECTED_SUBTITLES", "")
  const [downloadDirectory, setDownloadDirectory] = createStorageSignal("DOWNLOAD_DIRECTORY", "")

  createEffect(async () => {
    if (!downloadDirectory()) {
      setDownloadDirectory(await downloadDir())
    }
  })

  const download = async () => {
    setDownloading(true)
    try {
      await Toaster.try(async () => {
        const subtitles = selectedSubtitles() ?? ""

        const quality = selectedQuality() ?? "audio"
        if (!selectableQualities.includes(quality)) {
          throw new Error(`invalid value: ${quality}`)
        }

        const urls = urlList().split("\n")
          .filter(url => !!url.trim())
          .map(url => new URL(url.trim()))

        const [value, setValue] = createSignal(0)
        const [text, setText] = createSignal("")

        let cancelled = false
        const toast = Toaster.push({
          timeout: 0,
          closable: true,
          children: (
            <ProgressToast value={value()} max={urls.length} text={text()} />
          ),
          onclose: () => {
            cancelled = true
          },
        })

        try {
          const filePattern = `${downloadDirectory()}/%(title)s.%(ext)s`

          for (const url of urls) {
            if (cancelled) {
              throw new Error("downloads cancelled")
            }

            setText(`downloading ${url}`)

            await downloadYTVideo({
              url,
              output: filePattern,
              type: quality,
              subtitles,
            })

            setValue(v => v + 1)
          }

          setURLList("")

          Toaster.pushSuccess("downloaded")
        } finally {
          Toaster.remove(toast)
        }
      })
    } finally {
      setDownloading(false)
    }
  }

  const updateYTDLP = async () => {
    setDownloading(true)
    try {
      await Toaster.try(async () => {
        let fileToDownload = ""
        let fileToWrite = ""
        switch (await platform()) {
          case "linux":
            fileToDownload = "yt-dlp_linux"
            fileToWrite = "yt-dlp"
            break
          case "win32":
            fileToDownload = "yt-dlp.exe"
            fileToWrite = "yt-dlp.exe"
            break
          default:
            return
        }

        const urlToDownload = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${fileToDownload}`

        const response = await fetch<number[]>(urlToDownload, {
          method: "GET",
          responseType: ResponseType.Binary,
        })
        if (!response.ok) {
          throw new Error(String(response.status))
        }

        await writeFile(`./${fileToWrite}`, response.data)
      })
    } finally {
      setDownloading(false)
    }
  }

  const pickDownloadDirectory = async () => {
    const newDownloadDirectory = await dialog.open({
      defaultPath: downloadDirectory() ?? "",
      directory: true,
      recursive: false,
      multiple: false,
      title: "Download Directory",
    })
    if (!newDownloadDirectory) {
      return
    }

    setDownloadDirectory(newDownloadDirectory)
  }

  const openDownloadDirectory = async () => {
    open(downloadDirectory() ?? "")
  }

  const onpaste: ComponentProps<"input">["onpaste"] = e => {
    const input = e.currentTarget
    const clipboard = e.clipboardData?.getData("text/plain") ?? ""

    try {
      new URL(clipboard)
      setTimeout(() => {
        input.value += "\n"
      })
    } catch {
      // ignore
    }
  }

  return (
    <>
      <Section size="xl" marginY>
        <Column.Row>
          <Column>
            <Form.Group label="Format">
              <Select onchange={e => setSelectedQuality(selectableQualities[e.currentTarget.selectedIndex])}>
                <For each={selectableQualities}>
                  {quality => (
                    <option selected={selectedQuality() === quality}>{quality}</option>
                  )}
                </For>
              </Select>
            </Form.Group>
          </Column>

          <Column>
            <Form.Group label="Subtitles (like: en)">
              <Input value={selectedSubtitles() ?? ""} oninput={e => setSelectedSubtitles(e.currentTarget.value)} ifEmpty={""} disabled={selectedQuality() === "audio"} />
            </Form.Group>
          </Column>
        </Column.Row>

        <Form.Group label="URLs">
          <Input multiline value={urlList()} oninput={e => setURLList(e.currentTarget.value)} onpaste={onpaste} ifEmpty={""} style={{ height: "77vh" }} />
        </Form.Group>

        <Navbar>
          <Navbar.Section style={{ "max-width": "25%" }}>
            <Button onclick={updateYTDLP} loading={downloading()}>
              <Icon src={iconRefreshCw} />
              <span>Update</span>
            </Button>
          </Navbar.Section>

          <Navbar.Section>
            <Navbar style={{ "width": "100%" }}>
              <Navbar.Section>
                <Input.Group style={{ "width": "100%" }}>
                  <Input value={downloadDirectory() ?? ""} oninput={e => setDownloadDirectory(e.currentTarget.value)} ifEmpty={""} placeholder="Download Directory" />
                  <Button onclick={pickDownloadDirectory}>
                    <Icon src={iconFolder} />
                  </Button>
                  <Button onclick={openDownloadDirectory}>
                    <Icon src={iconBookOpen} />
                  </Button>
                </Input.Group>
              </Navbar.Section>

              <Navbar.Section style={{ "max-width": "25%" }}>
                <Button color="primary" onclick={download} loading={downloading()}>
                  <Icon src={iconDownload} />
                  <span>Download</span>
                </Button>
              </Navbar.Section>
            </Navbar>
          </Navbar.Section>
        </Navbar>
      </Section>
    </>
  )
}

export default HomeView
