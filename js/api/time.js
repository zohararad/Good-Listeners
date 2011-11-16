/**
 * Date parsing module
 */
var Time = {
  /**
   * Returns a new Date object 'seconds' secs in the future
   * @param {Number} seconds - number of seconds in the future
   * @return {Date} date object set 'seconds' secs in the future
   */
  secondsFromNow:function(seconds){
    return this._parse(seconds * 1000);
  },
  /**
   * Returns a new Date object 'seconds' secs in the past
   * @param {Number} seconds - number of seconds in the past
   * @return {Date} date object set 'seconds' secs in the past
   */
  secondsAgo:function(seconds){
    return this._parse(seconds * -1000);
  },
  /**
   * Returns a new Date object 'minutes' mins in the future
   * @param {Number} minutes - number of minutes in the future
   * @return {Date} date object set 'minutes' mins in the future
   */
  minutesFromNow:function(minutes){
    return this._parse(minutes * 60 * 1000);
  },
  /**
   * Returns a new Date object 'minutes' mins in the past
   * @param {Number} minutes - number of minutes in the past
   * @return {Date} date object set 'minutes' mins in the past
   */
  minutesAgo:function(minutes){
    return this._parse(minutes * 60 * -1000);
  },
  /**
   * Returns a new Date object 'hours' hrs in the future
   * @param {Number} hours - number of hours in the future
   * @return {Date} date object set 'hours' hrs in the future
   */
  hoursFromNow:function(hours){
    return this._parse(hours * 3600 * 1000);
  },
  /**
   * Returns a new Date object 'hours' hrs in the past
   * @param {Number} hours - number of hours in the past
   * @return {Date} date object set 'hours' hrs in the past
   */
  hoursAgo:function(hours){
    return this._parse(hours * 3600 * -1000);
  },
  /**
   * Returns a new Date object 'days' days in the future
   * @param {Number} days - number of days in the future
   * @return {Date} date object set 'days' days in the future
   */
  daysFromNow:function(days){
    return this._parse(days * 3600 * 24 * 1000);
  },
  /**
   * Returns a new Date object 'days' days in the past
   * @param {Number} days - number of days in the past
   * @return {Date} date object set 'days' days in the past
   */
  daysAgo:function(days){
    return this._parse(days * 3600 * 24 * -1000);
  },
  /**
   * Parses a date by interval in milliseconds in relation to current date and time.
   * @param {Number} ms - number of milliseconds difference between now and required date
   * @returns {Date} Date object 'ms' milliseconds difference from now
   */
  _parse:function(ms){
    return new Date(new Date().getTime() + ms);
  }
}