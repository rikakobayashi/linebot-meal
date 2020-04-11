import React, { useState } from 'react'
import * as ReactDOM from 'react-dom'
import 'react-dates/initialize'
import { DayPickerSingleDateController, SingleDatePicker } from 'react-dates'
import 'react-dates/lib/css/_datepicker.css'
import moment from 'moment'
import { DUMMY } from './dummy'
import { parse } from 'querystring'

export interface eatOutData {
  will_eatout: boolean
  date: string
}

interface AppProps {
  dummyData: eatOutData[]
}

interface AppState {
  date: moment.Moment
  myData?: eatOutData[]
}

class App extends React.Component<AppProps, AppState> {
  constructor(props: Readonly<AppProps>) {
    super(props)
    this.state = {
      date: moment(new Date())
    }
  }

  getQueryParam() {
    const rawParam = decodeURI(location.search)
    return parse(rawParam.slice(1)).id
  }

  fetchMyData = async () => {
    const body = { user_id: this.getQueryParam() }
    const res = fetch('/getMyData', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    }).then(res => {
      return res.json()
    })
    return res
  }

  postMyData = (will_eatout: boolean, date: moment.Moment) => {
    const body = {
      will_eatout: will_eatout,
      date: date.format('YYYY-MM-DD'),
      user_id: this.getQueryParam()
    }
    const res = fetch('/register', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    }).then(res => {
      this.fetchMyData().then(newData => {
        this.setState({
          myData: newData
        })
      })
    })
  }

  onDateChange = (date: moment.Moment | null, allData: eatOutData[]) => {
    if (!date) return
    const isDayHighlighted = this.isDayHighlighted(date, allData)
    this.postMyData(!isDayHighlighted, date)
  }

  isDayHighlighted = (date: moment.Moment, allData: eatOutData[]) => {
    const eatOutData = allData.find(data => {
      return (
        moment(data.date).format('YYYY-MM-DD') === date.format('YYYY-MM-DD')
      )
    })
    return eatOutData ? eatOutData.will_eatout : false
  }

  async componentDidMount() {
    const myData = await this.fetchMyData()
    this.setState({
      myData: myData
    })
  }

  render() {
    return (
      <DayPickerSingleDateController
        date={this.state.date}
        onDateChange={date =>
          this.onDateChange(
            date,
            this.state.myData ? this.state.myData : this.props.dummyData
          )
        }
        focused={true}
        onFocusChange={() => {}}
        isDayHighlighted={day =>
          this.isDayHighlighted(
            day,
            this.state.myData ? this.state.myData : this.props.dummyData
          )
        }
      />
    )
  }
}

ReactDOM.render(<App dummyData={DUMMY} />, document.getElementById('root'))
