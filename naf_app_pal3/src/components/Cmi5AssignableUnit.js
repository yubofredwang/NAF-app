import React, { Component } from 'react';
import Pal3Page from './Pal3Page';
const CMI_STATUS = {
  NONE: 0,
  LOADING: 1,
  READY: 2,
  RESULT_SENT: 3,
  ERROR: -1
}
const url = "http://qa-pal.ict.usc.edu/cmi5/?fetch=http://qa-pal.ict.usc.edu/api/1.0/cmi5/accesstoken2basictoken?access_token=8847d000-dba3-11e8-a05b-c40010c9cc01&endpoint=http://qa-pal.ict.usc.edu/api/1.0/cmi5/&activityId=http://pal.ict.usc.edu/activities/claire-the-counselor&registration=957f56b7-1d34-4b01-9408-3ffeb2053b28&actor=%7B%22objectType%22:%20%22Agent%22,%22name%22:%20%22clairelearner1%22,%22account%22:%20%7B%22homePage%22:%20%22http://pal.ict.usc.edu/xapi/users%22,%22name%22:%20%225bd749146b66c40010c9cc01%22%7D%7D"

/**
 * A reusable wrapper Component that handles cmi initialization
 * for a question (cmi5 assignable unit), which should be a child component.
 *
 * Cmi5AssignableUnit will inject the following props to it's child:
 *
 * passed:
 * A function for the assignable unit to call when the question was answered correctly.
 * For arguments, accepts either a single normalized score (0-1) value
 * or an object that's a valid XAPI result 'score'
 * @see https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md#Score
 *
 * failed:
 * A function for the assignable unit to call when the question was answered incorrectly.
 * For arguments, accepts either a single normalized score (0-1) value
 * or an object that's a valid XAPI result 'score'
 * @see https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md#Score
 *
 * cmi:
 * the Cmi5 instance, which can be used directly
 * @see ../public/cm5.js
 *
 * The actions for 'passed' and 'failed' are injected to child components
 * to provide a simple/safe way to submit results: this wrapped will handle
 * the actual initialization of cmi5,
 * and if either of the inject 'passed' or 'failed' functions is called
 * before cmi5 is ready, it will store the result and submit when ready.
 */
class Cmi5AssignableUnit extends Component {

  constructor(props) {
    super(props)
    this.state = {
      cmiStatus: CMI_STATUS.NONE,
      loading: true,
      answered: false
    }
    this.passed = this.passed.bind(this)
    this.failed = this.failed.bind(this)
    this.completed = this.completed.bind(this)
    this.terminate = this.terminate.bind(this)
    this._submitScore = this._submitScore.bind(this)
    this._execCmiOrQueue = this._execCmiOrQueue.bind(this)
  }
  
/**
 * A function for the assignable unit to call when the user passes an assessment (e.g. answers a question correctly.
 * 
 * @param {number|XAPI Score} score 
 *  
 * For arguments, accepts either a single normalized score (0.0-1.0) value
 * or an object that's a valid XAPI Result Score (https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md#2451-score)
 * 
 * @see https://github.com/AICC/CMI-5_Spec_Current/blob/quartz/cmi5_spec.md#verbs_failed} score 
 */
  passed(score) {
    this._submitScore(score, true)
  }

/**
 * A function for the assignable unit to call when the user fails an assessment (e.g. answers a question incorrectly.
 * 
 * @param {number|XAPI Score} score 
 *  
 * For arguments, accepts either a single normalized score (0.0-1.0) value
 * or an object that's a valid XAPI Result Score (https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md#2451-score)
 * 
 * @see https://github.com/AICC/CMI-5_Spec_Current/blob/quartz/cmi5_spec.md#verbs_failed} score 
 */
  failed(score) {
    this._submitScore(score, false)
  }

  /**
   * A function for the assignable unit to call, 
   * when it's a non-assessment type resource (no score)
   * and the user has completed it, e.g. finished watching a video.
   * 
   * @see https://github.com/AICC/CMI-5_Spec_Current/blob/quartz/cmi5_spec.md#verbs_completed
   */
  completed() {
    this._execCmiOrQueue(() => {
      this.state.cmi.completed()
    })
  }

/**
 * Required function the assignable unit MUST call, 
 * to signal to the LMS (container that launched the assignable unit)
 * that the user's session is complete (no additional xapi statements will be sent)
 * @see https://github.com/AICC/CMI-5_Spec_Current/blob/quartz/cmi5_spec.md#verbs_terminated
 */
  terminate() {
    this._execCmiOrQueue(() => {
      this.state.cmi.terminate()
    })
  }

/**
   * @private
   * submit a score if cmi is ready,
   * or if cmi is not ready, store the action for later execution.
   */
  _submitScore(result, isPassing) {
    const score = isNaN(Number(result))? result: { scaled: Number(result) }

    this._execCmiOrQueue(() => {
      if(isPassing) {
        this.state.cmi.passed(score)
      }
      else {
        this.state.cmi.failed(score)
      }
    })
    this.setState({
      ...this.state,
       answered: true
    })
  }

  /**
   * @private
   * Execute an action (generally a cmi call) if cmi is ready,
   * or if cmi is not ready, store the action for later execution.
   * 
   * @param {*} action - a function to call if/when cmi is ready
   */
  _execCmiOrQueue(action) {

    if(this.state.cmiStatus !== CMI_STATUS.READY) {
      // save the action to submit when cmi is ready
  
      this.setState({
        ...this.state,
        actionsPendingCmiReady: Array.isArray(this.state.actionsPendingCmiReady)?
          [...this.state.actionsPendingCmiReady, action] : [action]
      })

      return
    }

    try {
      action()
    }
    catch(cmiErr) {
        console.error(`cmi action failed: ${cmiErr.message}\n${cmiErr.stack}`)
    }
  }

  componentDidMount()
  {
    try {
      const Cmi5 = window.Cmi5
      const cmi = new Cmi5(url)

      cmi.start((err, result) => {
        if(err) {
          this.setState({
            ...this.state,
            cmiStatus: CMI_STATUS.ERROR,
            cmiMessage: err.message
          })
          console.error(err)
          return
        }

        console.log('ok!')
        this.setState({
          ...this.state,
          cmiStatus: CMI_STATUS.READY,
          loading: false
        })
      })

      this.setState({
        ...this.state,
        cmi: cmi,
      })
    }
    catch(errInit) {
      console.error(`error loading cmi: ${errInit.message}`)
      this.setState({
        ...this.state,
        cmiStatus: CMI_STATUS.NONE,
        cmiMessage: errInit.message
      })
    }

  }

  render()
  {
    console.log(`render state.cmiStatus=${this.state.cmiStatus}`)
    switch(this.state.cmiStatus) {
      case CMI_STATUS.READY:
        if(Array.isArray(this.state.actionsPendingCmiReady)) {
          this.actionsPendingCmiReady.forEach(a => a())
        }
        break
      case CMI_STATUS.ERROR:
        console.error(`cmi error: ${this.state.cmiMessage}`)
        break
      default:
        console.log(`cmi status updated to ${this.state.cmiStatus}`)
    }

    return(
    <div>
      <Pal3Page passed={this.passed} failed={this.failed} loading={this.state.loading} answered={this.state.answered}>
      </Pal3Page>
    </div>
    )
   }
 }

  export default Cmi5AssignableUnit
