'use strict'

require('dotenv').config()

const line = require('@line/bot-sdk')
const express = require('express')
const { Pool, Client } = require('pg')
const cron = require('node-cron')
const path = require('path')

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

app.use('/', express.static(path.join(__dirname, 'dist')))
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, 'dist/index.html'), {})
// })

app.post('/callback', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(result => res.json(result))
    .catch(err => {
      console.error(err)
      res.status(500).end()
    })
})

app.post('/register', async (req, res) => {
  const result = await updateEatOut(req.body.date)
  if (result === 0) {
    setEatOut(req.body.date)
  }
  res.redirect('/')
})

let userId = ''

// event handler
async function handleEvent(event) {
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
    text: await handleSchedule(event.message.text)
  }

  // use reply API
  return client.replyMessage(event.replyToken, response)
}

async function handleSchedule(text) {
  if (text == '確認') return await occasionalCheck()
  const words = text.replace(/　/g, ' ').split(' ')
  if (words.length != 2) return '正しく入力してください'
  const action = words[0]
  const time = words[1]
  switch (action) {
    case 'set': {
      return setSchedule(time)
    }
    case '登録': {
    }
    default:
      return '正しく入力してください'
  }
}

async function remind() {
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
  const eatOutToday = await checkEatOut()
  if (eatOutToday) {
    client.pushMessage(userId, informEatOut)
  } else if (eatOutToday === false) {
    client.pushMessage(userId, informNotEatOut)
  } else if (eatOutToday === null) {
    client.pushMessage(userId, check)
  }
}

async function occasionalCheck() {
  const eatOutToday = await checkEatOut()
  if (eatOutToday) {
    return '今日は外で食べる予定'
  } else if (eatOutToday === false) {
    return '今日は家で食べる予定'
  } else if (eatOutToday === null) {
    return 'まだ決まってない'
  }
}

async function checkEatOut(inputDate) {
  const today = new Date()
  const date = inputDate
    ? inputDate
    : today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate()
  const sql = `SELECT will_eatout FROM eatouts WHERE date='${date}' AND user_id='';`
  let willEatOut = null
  await DBclient.query(sql)
    .then(res => {
      if (res && res.rows[0]) {
        willEatOut = res.rows[0].will_eatout
      }
    })
    .catch(err => {
      console.log(err.stack)
    })
  return willEatOut
}

async function updateEatOut(data) {
  const sql = `UPDATE eatouts SET will_eatout = ${data.will_eatout} WHERE date = '${data.date}' AND user_id = '${data.user_id}';`
  let result = null
  await DBclient.query(sql)
    .then(res => {
      result = res.rowCount
    })
    .catch(err => {
      console.log(err.stack)
    })
  return result
}

async function setEatOut(data) {
  const sql = `INSERT INTO eatouts VALUES (${data.will_eatout}, '${data.body.date}', '${data.body.user_id}');`
  await DBclient.query(sql).catch(err => {
    console.log(err.stack)
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
