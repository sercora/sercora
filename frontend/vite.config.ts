import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const buildDate = new Date()

function pad(value: number) {
  return String(value).padStart(2, '0')
}

const buildNumber = [
  buildDate.getFullYear(),
  pad(buildDate.getMonth() + 1),
  pad(buildDate.getDate()),
  pad(buildDate.getHours()),
  pad(buildDate.getMinutes()),
  pad(buildDate.getSeconds())
].join('')

const buildDateLabel = [
  buildDate.getFullYear(),
  pad(buildDate.getMonth() + 1),
  pad(buildDate.getDate())
].join('-') + ' ' + [
  pad(buildDate.getHours()),
  pad(buildDate.getMinutes())
].join(':')

export default defineConfig({
  plugins: [react()],

  define: {
    __SERCORA_BUILD_NUMBER__: JSON.stringify(buildNumber),
    __SERCORA_BUILD_DATE__: JSON.stringify(buildDateLabel)
  },

  server: {
    host: "0.0.0.0",

    allowedHosts: [
      "sercora.serco.pro"
    ]
  }
})
