import React, { useState } from 'react'
import * as ReactDOM from 'react-dom'
import 'react-dates/initialize'
import { DayPickerSingleDateController, SingleDatePicker } from 'react-dates'
import 'react-dates/lib/css/_datepicker.css'
import moment from 'moment'
import { DUMMY } from './dummy'
import { parse } from 'querystring'
import './style.scss'

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

  getEatOutData = (date: moment.Moment, allData: eatOutData[]) => {
    return allData.find(data => {
      return !this.isOutsideRange(date)
        ? moment(data.date).format('YYYY-MM-DD') === date.format('YYYY-MM-DD')
        : false
    })
  }

  isDayHighlighted = (date: moment.Moment, allData: eatOutData[]) => {
    const eatOutData = this.getEatOutData(date, allData)
    return eatOutData ? eatOutData.will_eatout : false
  }

  renderDayContents = (date: moment.Moment, allData: eatOutData[]) => {
    const eatOutData = this.getEatOutData(date, allData)
    return eatOutData?.will_eatout === false ? (
      <div className="CalendarDay__notEatout_calendar">{date.format('D')}</div>
    ) : (
      date.format('D')
    )
  }

  isOutsideRange = (day: moment.Moment) => {
    return day.isBefore(
      moment()
        .locale('ja')
        .subtract(24, 'h')
        .add(1, 's')
    )
  }

  async componentDidMount() {
    const myData = await this.fetchMyData()
    this.setState({
      myData: myData
    })
  }

  render() {
    moment.lang('ja')
    return (
      <div className="content">
        <DayPickerSingleDateController
          date={null}
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
          monthFormat={'YYYY年M月'}
          initialVisibleMonth={() => moment().locale('ja')}
          weekDayFormat={'dd'}
          isOutsideRange={this.isOutsideRange}
          renderDayContents={day =>
            this.renderDayContents(
              day,
              this.state.myData ? this.state.myData : this.props.dummyData
            )
          }
          renderCalendarInfo={() => (
            <div className="calender-info">
              <p>
                <span className="color-box green" />
                外で食べる（ご飯いらない）
              </p>
              <p>
                <span className="color-box gray" />
                家で食べる（ご飯いる）
              </p>
            </div>
          )}
          hideKeyboardShortcutsPanel
        />
      </div>
    )
  }
}

ReactDOM.render(<App dummyData={DUMMY} />, document.getElementById('root'))
