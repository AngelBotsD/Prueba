import axios from "axios"
import yts from "yt-search"
import fs from "fs"
import path from "path"
import ffmpeg from "fluent-ffmpeg"
import { promisify } from "util"
import { pipeline } from "stream"
const streamPipe = promisify(pipeline)

const downloadPath = "./.downloads"
if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath)

const taskQueue = new Map()

function hash(t) {
  return Buffer.from(t).toString("base64").replace(/=/g, "")
}

function checkCache(p) {
  return fs.existsSync(p) && fs.statSync(p).size > 1024 * 60
}

const wait = ms => new Promise(r => setTimeout(r, ms))