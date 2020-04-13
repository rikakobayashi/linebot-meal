'use strict'

require('dotenv').config()

const line = require('@line/bot-sdk')
const express = require('express')
const { Pool, Client } = require('pg')
const cron = require('node-cron')
const path = require('path')
const bodyParser = require('body-parser')

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

app.post('/callback', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(result => res.json(result))
    .catch(err => {
      console.error(err)
      res.status(500).end()
    })
})

app.use(
  bodyParser.urlencoded({
    extended: true
  })
)
app.use(bodyParser.json())

app.use(express.static(path.join(__dirname, 'dist')))
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'), {})
})

app.post('/getMyData', async (req, res) => {
  const myData = await getMyData(req.body.id)
  res.send(myData)
})

app.post('/register', async (req, res) => {
  const result = await updateEatOut(req.body)
  if (result === 0) {
    setEatOut(req.body)
  }
  res.redirect('/')
})

// event handler
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    // ignore non-text-message event
    return Promise.resolve(null)
  }

  // create a echoing text message
  const echo = {
    type: 'text',
    text: event.message.text
  }

  if (
    event.message.text === '家で食べる' ||
    event.message.text === '外で食べる'
  )
    return

  // グループの場合はgroupId, トークルームの場合はroomId, 個人の場合はuserIdを返す
  const id =
    event.source.type === 'group'
      ? event.source.groupId
      : event.source.type === 'room'
      ? event.source.roomId
      : event.source.userId

  const response = await handleSchedule(event.message.text, id)

  // use reply API
  return client.replyMessage(event.replyToken, response)
}

async function handleSchedule(text, id) {
  switch (text) {
    case '登録': {
      return {
        type: 'template',
        altText: '予定を登録',
        template: {
          type: 'buttons',
          title: '予定を登録',
          text: '登録ボタンをタップするとカレンダーページに飛びます',
          actions: [
            {
              type: 'uri',
              label: '登録する',
              uri: process.env.BASE_URL + '?id=' + id
            }
          ]
        }
      }
    }
    case '確認': {
      return occasionalCheck(id).then(res => {
        return getTextMessage(res)
      })
    }
    default: {
      const words = text.replace(/　/g, ' ').split(' ')
      if (words.length != 2) return getTextMessage('正しく入力してください')
      const action = words[0]
      const time = words[1]
      switch (action) {
        case 'リマインド': {
          return setSchedule(time, id)
        }
        default:
          return getTextMessage('正しく入力してください')
      }
    }
  }
}

function getTextMessage(text) {
  return {
    type: 'text',
    text: text
  }
}

async function remind(id) {
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
          text: '家で食べる'
        },
        {
          type: 'message',
          label: 'いいえ',
          text: '外で食べる'
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
  const eatOutToday = await checkEatOutToday(id)
  if (eatOutToday) {
    client.pushMessage(id, informEatOut)
  } else if (eatOutToday === false) {
    client.pushMessage(id, informNotEatOut)
  } else if (eatOutToday === null) {
    client.pushMessage(id, check)
  }
}

async function occasionalCheck(id) {
  const eatOutToday = await checkEatOutToday(id)
  if (eatOutToday) {
    return '今日は外で食べる予定'
  } else if (eatOutToday === false) {
    return '今日は家で食べる予定'
  } else if (eatOutToday === null) {
    return 'まだ決まってない'
  }
}

async function getMyData(id) {
  const sql = `SELECT will_eatout,date FROM eatouts WHERE user_id='${id}'`
  let myData = null
  await DBclient.query(sql)
    .then(res => {
      myData = res.rows
    })
    .catch(err => {
      console.log(err.stack)
    })
  return myData
}

async function checkEatOutToday(id) {
  const today = new Date()
  const date =
    today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate()
  const sql = `SELECT will_eatout FROM eatouts WHERE date='${date}' AND user_id='${id}'`
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
  const sql = `UPDATE eatouts SET will_eatout = ${data.will_eatout} WHERE date = '${data.date}' AND user_id = '${data.id}'`
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
  const sql = `INSERT INTO eatouts VALUES (${data.will_eatout}, '${data.date}', '${data.id}');`
  await DBclient.query(sql).catch(err => {
    console.log(err.stack)
  })
}

function setSchedule(time, id) {
  const when = parseTime(time)
  if (!when)
    return '時間は半角数字、「:」区切りで正しく入力してください。\n[例] 15:00'
  cron.schedule(when, () => remind(id), {
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
