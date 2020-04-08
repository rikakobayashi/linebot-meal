'use strict'

require('dotenv').config()

const line = require('@line/bot-sdk')
const express = require('express')
const { Pool, Client } = require('pg')
const cron = require('node-cron')

// set database
const DBclient = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  password: process.env.DB_PASSWORD
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

let userId = ''

// event handler
function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    // ignore non-text-message event
    return Promise.resolve(null)
  }

  userId = event.source.userId

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
  if (words == '確認') return occasionalCheck()
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

function remind() {
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
  const informNotEatOut = {
    type: 'text',
    text: '今日は家で食べるよ'
  }
  const informEatOut = {
    type: 'text',
    text: '今日は外で食べるよ'
  }
  if (checkEatOutToday()) {
    client.pushMessage(userId, informEatOut)
  } else if (checkEatOutToday() === false) {
    client.pushMessage(userId, informNotEatOut)
  } else if (checkEatOutToday() === null) {
    client.pushMessage(userId, check)
  }
}

function occasionalCheck() {
  const willEatOut = {
    type: 'text',
    text: '今日は外で食べる予定'
  }
  const willNotEatOut = {
    type: 'text',
    text: '今日は家で食べる予定'
  }
  const undecided = {
    type: 'text',
    text: 'まだ決まってない'
  }
  if (checkEatOutToday()) {
    return willEatOut
  } else if (checkEatOutToday() === false) {
    return willNotEatOut
  } else if (checkEatOutToday() === null) {
    return undecided
  }
}

function checkEatOutToday() {
  const today = new Date()
  const date =
    today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate()
  const sql = `SELECT WILLEATOUT FROM EATOUTS WHERE DATE=${date} AND userId=${userId}`
  client.query(sql, (err, res) => {
    if (err) {
      console.log(err.stack)
    } else {
      if (!res || !res.rows[0]) return null
      return res.rows[0]
    }
  })
}

function setSchedule(time) {
  const when = parseTime(time)
  if (!when)
    return '時間は半角数字、「:」区切りで正しく入力してください。\n[例] 15:00'
  cron.schedule(when, remind, {
    scheduled: true,
    timezone: 'Asia/Tokyo'
  })
  return '毎日' + time + 'にリマインドを送ります'
}

function parseTime(time) {
  const timeArray = time.split(':')
  const hour = parseInt(timeArray[0])
  const minute = parseInt(timeArray[1])
  if (!hour || !minute) return null
  if (hour >= 24 || minute >= 60) return null
  return '00 ' + minute + ' ' + hour + ' * * *'
}

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`listening on ${port}`)
})
