import { iconBookOpen } from "@gazatu/solid-spectre/icons/iconBookOpen"
import { iconDownload } from "@gazatu/solid-spectre/icons/iconDownload"
import { iconFolder } from "@gazatu/solid-spectre/icons/iconFolder"
import { iconRefreshCw } from "@gazatu/solid-spectre/icons/iconRefreshCw"
import { Button } from "@gazatu/solid-spectre/ui/Button"
import { Column } from "@gazatu/solid-spectre/ui/Column"
import { Form } from "@gazatu/solid-spectre/ui/Form"
import { Icon } from "@gazatu/solid-spectre/ui/Icon"
import { Input } from "@gazatu/solid-spectre/ui/Input"
import { Navbar } from "@gazatu/solid-spectre/ui/Navbar"
import { Progress } from "@gazatu/solid-spectre/ui/Progress"
import { Section } from "@gazatu/solid-spectre/ui/Section"
import { Select2 } from "@gazatu/solid-spectre/ui/Select2"
import { Toaster } from "@gazatu/solid-spectre/ui/Toaster"
import { createStorageSignal } from "@solid-primitives/storage"
import * as dialog from "@tauri-apps/api/dialog"
import { ResponseType, fetch } from "@tauri-apps/api/http"
import { platform } from "@tauri-apps/api/os"
import { appCacheDir, dirname, downloadDir } from "@tauri-apps/api/path"
import { Command, open } from "@tauri-apps/api/shell"
import { invoke } from "@tauri-apps/api/tauri"
import { UserAttentionType, appWindow } from "@tauri-apps/api/window"
import { Component, ComponentProps, Show, createEffect, createSignal } from "solid-js"
import { copyFile, createDir, pathExists, writeFile } from "../lib/tauri-plugin-fs"
import "./Home.scss"

const tauriExeDir = async () => {
  return await dirname(await invoke<string>("env_current_exe"))
}

const isAppImage = async () => {
  const env = await invoke<{ [key: string]: string }>("env_vars")
  return !!env["APPIMAGE"]
}

const selectableQualities = ["audio", "1440p", "1080p", "720p"] as const
const selectableAudioFormats = ["flac", "mp3", "opus"] as const
const selectableVideoFormats = ["mp4", "mkv"] as const

const getFFMPEGLocation = async () => {
  if (await isAppImage() && await pathExists(`${await appCacheDir()}/ffmpeg`)) {
    return `${await appCacheDir()}/ffmpeg`
  } else {
    return `${await tauriExeDir()}/ffmpeg${(await platform() === "win32") ? ".exe" : ""}`
  }
}

const createYTDLPCommand = async (args: string[]) => {
  args = [...args, `--ffmpeg-location=${await getFFMPEGLocation()}`]

  if (await isAppImage() && await pathExists(`${await appCacheDir()}/yt-dlp`)) {
    return Command.create("$home/.local/bin/yt-dlp", args)
  }

  return Command.sidecar("bin/yt-dlp", args)
}

type YTVideoFormat = {
  id: string,
  format: string,
  resolution: string,
  fps: string,
}

const listYTVideoFormats = async (url: URL) => {
  const formats = [] as YTVideoFormat[]

  const command = await createYTDLPCommand([
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

type YTDLPDownloadProgressEvent = {
  percentage: number
  downloaded: number
  downloadedUnit: string
  speed: number
  speedUnit: string
  eta: string
}

type YTDLPDownloadOptions = {
  url: URL
  output: string
  type: "audio" | "1440p" | "1080p" | "720p"
  fileFormat?: string
  subtitles?: string
  onProgress?: (event: YTDLPDownloadProgressEvent) => unknown
}

const downloadVideo = async (options: YTDLPDownloadOptions) => {
  const { url, output, type, fileFormat, subtitles, onProgress } = options

  const formats = await listYTVideoFormats(url)

  const ytdlpArgs = ["--no-playlist", "--concurrent-fragments=4", "--embed-metadata", "--embed-thumbnail"]
  if (type === "audio") {
    const bestAudio = formats.audioOnly[formats.audioOnly.length - 1]

    ytdlpArgs.push(`--format=${bestAudio.id}`, "--extract-audio", "--audio-format=mp3", "--audio-quality=0")

    if (fileFormat) {
      ytdlpArgs.push(`--audio-format=${fileFormat}`)
    }
  } else {
    let quality = type

    let selectedFormats = [] as (typeof formats)["videoOnly"][number][]
    while (selectedFormats.length === 0) {
      const resolution = quality.replace("p", "")
      selectedFormats = formats.videoOnly.filter(f => f.resolution.endsWith(resolution))

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

    ytdlpArgs.push(`--format=${bestVideo.id}+${bestAudio.id}`)

    if (fileFormat) {
      ytdlpArgs.push(`--remux-video=${fileFormat}`)
    }

    if (subtitles) {
      ytdlpArgs.push(`--sub-langs=${subtitles}.*`, "--embed-subs")
    }
  }

  ytdlpArgs.push("--quiet", "--progress", "--newline")

  ytdlpArgs.push("--windows-filenames", `--output=${output}`, url.href)

  console.log("yt-dlp", ...ytdlpArgs)

  const command = await createYTDLPCommand(ytdlpArgs)

  await new Promise<void>((resolve, reject) => {
    const state = {
      percentage: 0,
      stderr: "",
    }

    command.on("error", error => {
      reject(error)
    })

    command.on("close", ({ code }) => {
      if (code === 0) {
        resolve()
      } else {
        reject(state.stderr)
      }
    })

    command.stdout.on("data", line => {

      const regex = /^\[download\]\s+(\d+)\.\d+%\s+\S*\s+\S*\s+(\d+)\.\d+(\S+)\s+\S*\s+(\d+)\.\d+(\S+)\s+\S*\s+(\S+)/
      const match = regex.exec(line)
      if (!match) {
        return
      }

      const [, percentage, downloaded, downloadedUnit, speed, speedUnit, eta] = match
      if (Number(percentage) !== 0 && (Number(percentage) - state.percentage) < 1) {
        return
      }

      state.percentage = Number(percentage)

      onProgress?.({
        percentage: Math.min(Number(percentage), 100),
        downloaded: Number(downloaded),
        downloadedUnit,
        speed: Number(speed),
        speedUnit,
        eta,
      })
    })

    command.stderr.on("data", line => {
      state.stderr += line + "\n"
    })

    command.spawn()
  })
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
      <pre>{props.text}</pre>
    </div>
  )
}

const HomeView: Component = () => {
  const [downloading, setDownloading] = createSignal(false)
  const [updating, setUpdating] = createSignal(false)

  const [urlList, setURLList] = createStorageSignal("URL_LIST", "")
  const [selectedQuality, setSelectedQuality] = createStorageSignal<(typeof selectableQualities)[number]>("SELECTED_QUALITY", "audio")
  const [selectedSubtitles, setSelectedSubtitles] = createStorageSignal("SELECTED_SUBTITLES", "")
  const [downloadDirectory, setDownloadDirectory] = createStorageSignal("DOWNLOAD_DIRECTORY", "")

  const [audioFileFormat, setAudioFileFormat] = createStorageSignal<(typeof selectableAudioFormats)[number]>("AUDIO_FILE_FORMAT", "mp3")
  const [videoFileFormat, setVideoFileFormat] = createStorageSignal<(typeof selectableVideoFormats)[number]>("VIDEO_FILE_FORMAT", "mkv")

  createEffect(async () => {
    if (!downloadDirectory()) {
      setDownloadDirectory(await downloadDir())
    }
  })

  const [urlsProgress, setURLsProgress] = createSignal(0)
  const [urlsProgressText, setURLsProgressText] = createSignal("")
  const [videoProgress, setVideoProgress] = createSignal(0)
  const [videoProgressText, setVideoProgressText] = createSignal("")

  const download = async () => {
    setDownloading(true)
    try {
      await Toaster.try(async () => {
        const subtitles = selectedSubtitles() ?? ""

        const quality = selectedQuality() ?? "audio"
        if (!selectableQualities.includes(quality)) {
          throw new Error(`invalid value: ${quality}`)
        }

        const urls = (urlList() ?? "").split("\n")
          .filter(url => !!url.trim())
          .map(url => new URL(url.trim()))

        const appWindowState = {
          focused: true,
        }
        const unlistenFocusChanged = await appWindow.onFocusChanged(({ payload: focused }) => {
          appWindowState.focused = focused
        })

        let cancelled = false
        const urlsProgressToast = (() => {
          if (urls.length < 2) {
            // eslint-disable-next-line solid/components-return-once
            return ""
          }

          setURLsProgress(0)
          setURLsProgressText(`downloading video ${urlsProgress() + 1} out of ${urls.length}`)

          return Toaster.push({
            timeout: 0,
            closable: true,
            children: (
              <ProgressToast value={urlsProgress()} max={urls.length} text={urlsProgressText()} />
            ),
            onclose: () => {
              cancelled = true
            },
          })
        })()

        try {
          const filePattern = `${downloadDirectory()}/%(title)s.%(ext)s`

          for (const url of urls) {
            if (cancelled) {
              throw new Error("downloads cancelled")
            }

            setURLsProgressText(`downloading video ${urlsProgress() + 1} out of ${urls.length}`)

            setVideoProgress(0)
            setVideoProgressText(`${url}\n${0}% (${0}${"KiB"}) at ${0}${"KiB/s"} ETA ${"Unknown"}`)

            const videoProgressToast = Toaster.push({
              timeout: 0,
              closable: false,
              children: (
                <ProgressToast value={videoProgress()} max={100} text={videoProgressText()} />
              ),
            })

            try {
              await downloadVideo({
                url,
                output: filePattern,
                type: quality,
                fileFormat: ((quality === "audio") ? audioFileFormat() : videoFileFormat()) ?? undefined,
                subtitles,
                onProgress: event => {
                  setVideoProgress(event.percentage)
                  setVideoProgressText(`${url}\n${event.percentage}% (${event.downloaded}${event.downloadedUnit}) at ${event.speed}${event.speedUnit} ETA ${event.eta}`)
                },
              })
            } finally {
              Toaster.remove(videoProgressToast)
            }

            setURLsProgress(v => v + 1)
            setURLList(l => l?.replace(url.href, "") ?? null)
          }

          setURLList("")

          Toaster.pushSuccess("downloaded")

          unlistenFocusChanged()
          if (!appWindowState.focused) {
            await appWindow.requestUserAttention(UserAttentionType.Informational)
            const unlistenFocusChanged = await appWindow.onFocusChanged(() => {
              unlistenFocusChanged()
              appWindow.requestUserAttention(null)
            })
          }
        } finally {
          Toaster.remove(urlsProgressToast)
        }
      })
    } finally {
      setDownloading(false)
    }
  }

  const updateYTDLP = async () => {
    setUpdating(true)
    try {
      await Toaster.try(async () => {
        let fileToDownload = ""
        let fileToWrite = ""
        switch (await platform()) {
          case "win32":
            fileToDownload = "yt-dlp.exe"
            fileToWrite = "yt-dlp.exe"
            break
          case "linux":
            fileToDownload = "yt-dlp_linux"
            fileToWrite = "yt-dlp"
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

        if (await isAppImage()) {
          if (!await pathExists(await appCacheDir())) {
            await createDir(await appCacheDir())
          }

          const ytdlp = `${await appCacheDir()}/${fileToWrite}`
          if (!await pathExists(ytdlp)) {
            await copyFile(`${await tauriExeDir()}/${fileToWrite}`, ytdlp)
          }

          const ffmpeg = `${await appCacheDir()}/ffmpeg`
          if (!await pathExists(ffmpeg)) {
            await copyFile(`${await tauriExeDir()}/ffmpeg`, ffmpeg)
          }

          await writeFile(ytdlp, response.data)
        } else {
          await writeFile(`${await tauriExeDir()}/${fileToWrite}`, response.data)
        }

        Toaster.pushSuccess("updated yt-dlp")
      })
    } finally {
      setUpdating(false)
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
      <Section class="HomeView" size="xl">
        <Column.Row>
          <Column>
            <Form.Group label="Quality">
              <Select2 options={selectableQualities as any} renderOption={o => o} stringifyOption={o => o} selected={selectedQuality()} onselect={o => setSelectedQuality(o)} disabled={downloading()} />
            </Form.Group>
          </Column>

          <Column>
            <Form.Group label="File Format">
              <Show when={selectedQuality() === "audio"} fallback={
                <Select2 options={selectableVideoFormats as any} renderOption={o => o} stringifyOption={o => o} selected={videoFileFormat()} onselect={o => setVideoFileFormat(o)} disabled={downloading()} />
              }>
                <Select2 options={selectableAudioFormats as any} renderOption={o => o} stringifyOption={o => o} selected={audioFileFormat()} onselect={o => setAudioFileFormat(o)} disabled={downloading()} />
              </Show>
            </Form.Group>
          </Column>

          <Column>
            <Form.Group label="Subtitles (like: en)">
              <Input value={selectedSubtitles() ?? ""} oninput={e => setSelectedSubtitles(e.currentTarget.value)} ifEmpty={""} disabled={downloading() || selectedQuality() === "audio"} />
            </Form.Group>
          </Column>
        </Column.Row>

        <Form.Group class="urls" label="URLs">
          <Input multiline value={urlList() ?? ""} oninput={e => setURLList(e.currentTarget.value)} onpaste={onpaste} ifEmpty={""} disabled={downloading()} />
        </Form.Group>

        <Navbar class="controls">
          <Navbar.Section style={{ "max-width": "25%" }}>
            <Button onclick={updateYTDLP} loading={updating()} disabled={downloading()}>
              <Icon src={iconRefreshCw} />
              <span>Update</span>
            </Button>
          </Navbar.Section>

          <Navbar.Section>
            <Navbar style={{ "width": "100%" }}>
              <Navbar.Section>
                <Input.Group style={{ "width": "100%" }}>
                  <Input value={downloadDirectory() ?? ""} oninput={e => setDownloadDirectory(e.currentTarget.value)} ifEmpty={""} placeholder="Download Directory" disabled={downloading()} />
                  <Button onclick={pickDownloadDirectory} disabled={downloading()}>
                    <Icon src={iconFolder} />
                  </Button>
                  <Button onclick={openDownloadDirectory}>
                    <Icon src={iconBookOpen} />
                  </Button>
                </Input.Group>
              </Navbar.Section>

              <Navbar.Section style={{ "max-width": "25%" }}>
                <Button color="primary" onclick={download} loading={downloading()} disabled={updating()}>
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
