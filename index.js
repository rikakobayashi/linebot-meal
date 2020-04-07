'use strict'

require('dotenv').config()

const line = require('@line/bot-sdk')
const express = require('express')
const { Pool, Client } = require('pg')
const cron = require('node-cron')

// set database
const DBclient = new Client({
  user: 'rikakobayashi',
  host: 'localhost',
  database: 'testDB',
  password: ''
})

DBclient.connect()

// create LINE SDK config from env variables
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
}

// create LINE SDK client
const client = new line.Client(config)

// create Express app
// about Express itself: https://expressjs.com/
const app = express()

app.set('view engine', 'ejs')
app.get('/', (req, res) => {
  res.render('index', {})
})

app.post('/callback', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(result => res.json(result))
    .catch(err => {
      console.error(err)
      res.status(500).end()
    })
})

// event handler
function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    // ignore non-text-message event
    return Promise.resolve(null)
  }

  // create a echoing text message
  const echo = {
    type: 'text',
    text: event.message.text
  }

  const response = {
    type: 'text',
    text: handleSchedule(event.message.text)
  }

  // use reply API
  return client.replyMessage(event.replyToken, response)
}

function handleSchedule(text) {
  const words = text.replace(/　/g, ' ').split(' ')
  if (words.length != 2) return '正しく入力してください'
  const action = words[0]
  const time = words[1]
  switch (action) {
    case 'set': {
      return setSchedule(time)
    }
    default:
      return '正しく入力してください'
  }
}

function checkEatOut() {
  const check = {
    type: 'template',
    altText: 'this is a confirm template',
    template: {
      type: 'confirm',
      text: '今日は家で食べる？',
      actions: [
        {
          type: 'message',
          label: 'はい',
          text: 'yes'
        },
        {
          type: 'message',
          label: 'いいえ',
          text: 'no'
        }
      ]
    }
  }
  client.pushMessage('1654004698', check)
}

function setSchedule(time) {
  const when = parseTime(time)
  if (!when)
    return '時間は半角数字、「:」区切りで入力してください。\n[例] 15:00'
  cron.schedule(when, checkEatOut)
  return '毎日' + text + 'にリマインドを送ります'
}

function parseTime(time) {
  //   const setMessage = /^set/i
  //   if (text.match(setMessage) === null) {
  // 確認時間を設定
  const timeArray = time.split(':')
  const hour = parseInt(timeArray[0])
  const minute = parseInt(timeArray[1])
  console.log(time + ' ' + !hour + ' ' + !minute)
  if (!hour || !minute) return null
  console.log('ok')
  if (hour < 24 || minute < 60) return null
  console.log('ok!')
  return '00 ' + minute + ' ' + hour + ' * * *'
  //   }
}

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`listening on ${port}`)
})
