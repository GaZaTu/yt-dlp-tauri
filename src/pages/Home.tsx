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
import { platform, tempdir } from "@tauri-apps/api/os"
import { appCacheDir, basename, dirname, downloadDir } from "@tauri-apps/api/path"
import { Command, open } from "@tauri-apps/api/shell"
import { invoke } from "@tauri-apps/api/tauri"
import { UserAttentionType, appWindow } from "@tauri-apps/api/window"
import { Component, ComponentProps, JSX, Show, createEffect, createSignal } from "solid-js"
import { copyFile, createDir, pathExists, removeFile, writeFile } from "../lib/tauri-plugin-fs"
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
  args = [`--ffmpeg-location=${await getFFMPEGLocation()}`, ...args]

  console.log("yt-dlp", ...args)

  if (await isAppImage() && await pathExists(`${await appCacheDir()}/yt-dlp`)) {
    return Command.create("$home/.local/bin/yt-dlp", args)
  }

  return Command.sidecar("bin/yt-dlp", args)
}

class CancellationToken {
  private _cancelled = false
  private _listener = () => undefined

  get cancelled() {
    return this._cancelled
  }

  cancel() {
    this._cancelled = true
    this._listener()
  }

  listen(listener: () => any) {
    this._listener = listener

    if (this._cancelled) {
      this._listener()
    }
  }
}

type YTDLPDownloadProgressEvent = {
  url: URL
  title: string
  percentage: number
  downloaded: number
  downloadedUnit: string
  total: number
  totalUnit: string
  speed: number
  speedUnit: string
  eta: number
  etaUnit: string
}

type YTDLPDownloadOptions = {
  urls: URL[]
  output: string
  type: "audio" | "1440p" | "1080p" | "720p"
  fileFormat?: string
  subtitles?: string
  onProgress?: (event: YTDLPDownloadProgressEvent) => unknown
  cancellationToken?: CancellationToken
}

const downloadVideos = async (options: YTDLPDownloadOptions) => {
  const { urls, output, type, fileFormat, subtitles, onProgress, cancellationToken } = options

  const ytdlpArgs = ["--no-playlist", "--concurrent-fragments=4", "--embed-metadata"]
  if (type === "audio") {
    ytdlpArgs.push("--format=bestaudio", "--extract-audio", "--audio-format=mp3", "--audio-quality=0", "--embed-thumbnail")

    if (fileFormat) {
      ytdlpArgs.push(`--audio-format=${fileFormat}`)
    }
  } else {
    const height = type.replace("p", "")
    ytdlpArgs.push(`--format=bestvideo[height<=${height}]+bestaudio`)

    if (fileFormat) {
      ytdlpArgs.push(`--remux-video=${fileFormat}`)
    }

    if (subtitles) {
      ytdlpArgs.push(`--sub-langs=${subtitles}.*`, "--embed-subs")
    }
  }

  type RawProgressEvent = {
    type: "download"
    title: string
    url: string
    status: "downloading" | "finished"
    downloadedBytes: string
    totalBytes: string
    eta: string
    speed: string
  } | {
    type: "postprocess"
    title: string
    url: string
    status: "started" | "finished"
  }

  ytdlpArgs.push("--quiet", "--progress", "--progress-template=download:{\"type\":\"download\",\"title\":%(info.title)j,\"url\":%(info.original_url)j,\"status\":%(progress.status)j,\"downloadedBytes\":\"%(progress.downloaded_bytes)j\",\"totalBytes\":\"%(progress.total_bytes)j\",\"eta\":\"%(progress.eta)s\",\"speed\":\"%(progress.speed)j\"}", "--progress-template=postprocess:{\"type\":\"postprocess\",\"title\":%(info.title)j,\"url\":%(info.original_url)j,\"status\":%(progress.status)j}", "--newline")

  const batchFile = await (async () => {
    // eslint-disable-next-line no-constant-condition
    for (let i = 0; true; i++) {
      const path = `${await tempdir()}/ytdlp-${i}`
      if (await pathExists(path)) {
        continue
      }

      await writeFile(path, new TextEncoder().encode(urls.join("\n")))
      return path
    }
  })()

  ytdlpArgs.push("--windows-filenames", `--output=${output}`, `--batch-file=${batchFile}`)

  try {
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
        try {
          const event = JSON.parse(line) as RawProgressEvent

          if (event.type === "postprocess") {
            if (event.status !== "finished") {
              return
            }

            onProgress?.({
              url: new URL(event.url),
              title: event.title,
              percentage: 100,
              downloaded: 0,
              downloadedUnit: "MiB",
              total: 0,
              totalUnit: "MiB",
              speed: 0,
              speedUnit: "MiB/s",
              eta: 0,
              etaUnit: "s",
            })

            return
          }

          const downloadedBytes = (event.downloadedBytes === "NA") ? 0 : Number(event.downloadedBytes)
          const totalBytes = (event.totalBytes === "NA") ? 0 : Number(event.totalBytes)
          const eta = (event.eta === "NA") ? 0 : Number(event.eta)
          const speed = (event.speed === "NA") ? 0 : Number(event.speed)

          const percentage = (() => {
            if (totalBytes === 0) {
              return 0
            }

            return Math.floor((downloadedBytes / totalBytes) * 100)
          })()
          if (percentage > 0 && (percentage - state.percentage) < 1) {
            return
          }

          state.percentage = percentage

          onProgress?.({
            url: new URL(event.url),
            title: event.title,
            percentage: Math.min(percentage, 100),
            downloaded: Math.floor(Math.max(downloadedBytes, 0) / 1024 / 1024),
            downloadedUnit: "MiB",
            total: Math.floor(Math.max(totalBytes, 0) / 1024 / 1024),
            totalUnit: "MiB",
            speed: Math.floor(Math.max(speed, 0) / 1024 / 1024),
            speedUnit: "MiB/s",
            eta: eta,
            etaUnit: "s",
          })
        } catch (error) {
          console.error(error)
          console.warn(line)
        }
      })

      command.stderr.on("data", line => {
        state.stderr += line + "\n"
      })

      command.spawn().then(async ytdlp => {
        cancellationToken?.listen(async () => {
          await ytdlp.kill()
          reject("Downloads cancelled")
        })
      })
    })
  } finally {
    try {
      await removeFile(batchFile)
    } catch {
      // ignore
    }
  }
}

type ProgressToast = {
  value: number | undefined
  max: number
  children: JSX.Element
}

const ProgressToast: Component<ProgressToast> = props => {
  return (
    <div style={{ width: "96vw" }}>
      <div>
        <Show when={props.value !== undefined} fallback={<Progress />}>
          <Progress value={props.value} max={props.max} />
        </Show>
      </div>
      <pre>{props.children}</pre>
    </div>
  )
}

const HomeView: Component = () => {
  const [downloading, setDownloading] = createSignal(false)
  const [updating, setUpdating] = createSignal(false)

  const [urlList, setURLList] = createStorageSignal("URL_LIST", "")
  const [selectedQuality, setSelectedQuality] = createStorageSignal<(typeof selectableQualities)[number]>("SELECTED_QUALITY", "audio")
  const [selectedSubtitles, setSelectedSubtitles] = createStorageSignal("SELECTED_SUBTITLES", "")
  const [downloadPath, setDownloadPath] = createStorageSignal("DOWNLOAD_PATH", "")

  const [audioFileFormat, setAudioFileFormat] = createStorageSignal<(typeof selectableAudioFormats)[number]>("AUDIO_FILE_FORMAT", "mp3")
  const [videoFileFormat, setVideoFileFormat] = createStorageSignal<(typeof selectableVideoFormats)[number]>("VIDEO_FILE_FORMAT", "mkv")

  createEffect(async () => {
    if (!downloadPath()) {
      setDownloadPath(`${await downloadDir()}/%(title)s.%(ext)s`)
    }
  })

  const [urlsProgress, setURLsProgress] = createSignal(0)
  const [videoProgress, setVideoProgress] = createSignal(undefined as YTDLPDownloadProgressEvent | undefined)

  const download = async () => {
    setDownloading(true)
    try {
      await Toaster.try(async () => {
        const subtitles = selectedSubtitles() ?? ""

        const quality = selectedQuality() ?? "audio"
        if (!selectableQualities.includes(quality)) {
          throw new Error(`invalid value: ${quality}`)
        }

        const urlsIncludingFails = (urlList() ?? "").split("\n")
          .map(url => url.trim())
          .map(url => {
            if (!url) {
              return undefined
            }

            try {
              return new URL(url)
            } catch {
              return undefined
            }
          })
        const urls = urlsIncludingFails
          .filter(url => !!url) as URL[]

        const appWindowState = {
          focused: true,
        }
        const unlistenFocusChanged = await appWindow.onFocusChanged(({ payload: focused }) => {
          appWindowState.focused = focused
        })

        const cancellationToken = new CancellationToken()
        const urlsProgressToast = (() => {
          if (urls.length < 2) {
            // eslint-disable-next-line solid/components-return-once
            return ""
          }

          setURLsProgress(0)

          return Toaster.push({
            timeout: 0,
            closable: false, // TODO: true (for some reason killing the process does not work)
            children: (
              <ProgressToast value={urlsProgress()} max={urls.length}>
                {`downloading video ${Math.min(urlsProgress() + 1, urls.length)} out of ${urls.length}`}
              </ProgressToast>
            ),
            onclose: () => {
              cancellationToken.cancel()
            },
          })
        })()

        setVideoProgress(undefined)

        const videoProgressToast = Toaster.push({
          timeout: 0,
          closable: false,
          children: (
            <ProgressToast value={((videoProgress()?.percentage ?? 0) > 0) ? videoProgress()?.percentage : undefined} max={100}>
              <Show when={videoProgress()} fallback={<div>Preparing download</div>}>
                <div>{videoProgress()?.title}</div>
                <Column.Row style={{ "max-width": "33rem" }}>
                  <Column>{`${videoProgress()?.percentage ?? 0}%`}</Column>
                  <Column>{`(${videoProgress()?.downloaded ?? 0}${videoProgress()?.downloadedUnit})`}</Column>
                  <Column>of</Column>
                  <Column>{`${videoProgress()?.total ?? 0}${videoProgress()?.totalUnit}`}</Column>
                  <Column>at</Column>
                  <Column>{`${videoProgress()?.speed ?? 0}${videoProgress()?.speedUnit}`}</Column>
                  <Column>ETA</Column>
                  <Column>{`${videoProgress()?.eta ?? 0}${videoProgress()?.etaUnit}`}</Column>
                </Column.Row>
              </Show>
            </ProgressToast>
          ),
        })

        try {
          const downloadState = {
            url: undefined as URL | undefined,
            done: [] as URL[],
          }

          const updateURLList = () => {
            const doneHRefs = downloadState.done.map(url => url.href)
            const allHRefs = urlsIncludingFails.map(url => url?.href ?? "")
            setURLList(allHRefs.map(url => doneHRefs.includes(url) ? "" : url).join("\n"))
          }
          updateURLList()

          await downloadVideos({
            urls,
            output: downloadPath() ?? "",
            type: quality,
            fileFormat: ((quality === "audio") ? audioFileFormat() : videoFileFormat()) ?? undefined,
            subtitles,
            onProgress: event => {
              setVideoProgress(event)

              if (downloadState.url !== undefined && event.url.href !== downloadState.url.href) {
                downloadState.done.push(event.url)

                setURLsProgress(v => v + 1)
                updateURLList()
              }

              downloadState.url = event.url
            },
            cancellationToken,
          })

          Toaster.pushSuccess("downloaded")

          setURLList("")

          unlistenFocusChanged()
          if (!appWindowState.focused) {
            await appWindow.requestUserAttention(UserAttentionType.Informational)
            const unlistenFocusChanged = await appWindow.onFocusChanged(() => {
              unlistenFocusChanged()
              appWindow.requestUserAttention(null)
            })
          }
        } finally {
          Toaster.remove(videoProgressToast)
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
    await Toaster.try(async () => {
      const _downloadPath = downloadPath() ?? ""
      const downloadDir = await dirname(_downloadPath)
      const downloadPattern = await basename(_downloadPath)

      const newDownloadDirectory = await dialog.open({
        defaultPath: downloadDir,
        directory: true,
        recursive: false,
        multiple: false,
        title: "Download Directory",
      })
      if (!newDownloadDirectory) {
        return
      }

      setDownloadPath(`${newDownloadDirectory}/${downloadPattern}`)
    })
  }

  const openDownloadDirectory = async () => {
    await Toaster.try(async () => {
      const _downloadPath = downloadPath() ?? ""
      const downloadDir = await dirname(_downloadPath)

      await open(downloadDir)
    })
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
                  <Input value={downloadPath() ?? ""} oninput={e => setDownloadPath(e.currentTarget.value)} ifEmpty={""} placeholder="Download Directory" disabled={downloading()} />
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
