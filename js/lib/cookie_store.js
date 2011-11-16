/** SQLite Cookie Store */
var CookieStore = {
  _db:null, //internal reference to DB object
  /**
   * Initialize the cookie store.
   * Prepare the cookie table if it doesnt exist.
   * Clean up old cookies from the DB
   * @param {String} appID - crossrider app ID
   */
  init:function(appID){
    var now = new Date();
    this._db = openDatabase('crossrider_cookies_'+appID, 1, 'Crossrider Cookies Store', 10 * 1024 * 1024);
    this._db.transaction(function(tx) {
      tx.executeSql("create table if not exists cookies(name varchar(255) primary key, value longtext, created_at datetime default (datetime('now','localtime')), expires datetime)", []);
    });
    this._db.transaction(function(tx) {
      tx.executeSql("delete from cookies where datetime(expires) < datetime('now'))");
    });
  },
  /**
   * Get all active cookies from the DB
   * @param {Function} callback - callback to execute on the Background Page once all cookies are read
   */
  getCookies:function(callback){
    var now = new Date();
    this._db.transaction(function(tx) {
      tx.executeSql("select name,value,expires from cookies where datetime(expires) >= datetime('now')", [],function(tx, results){
        cookies = {};
        for (var i = 0; i < results.rows.length; i++) {
          var row = results.rows.item(i), c = JSON.parse(row.value);
          
          cookies[row.name] = {value:c.value,expires:this._formatDateFromDateTime(row.expires)};
        }
        callback(cookies);
      }.bind(this),function(){
      	console.log('getCookies error',arguments);
      });
    }.bind(this));
  },
  /**
   * Saves a cookie to the DB.
   * @param {String} name - cookie name to set / get
   * @param {Variable} value - cookie value to set
   * @param {Date} expires - cookie expiration date
   * @param {Function} onSuccess - cookie set onSuccess callback
   * @param {Function} onFailure - cookie set onFailure callback
   */
  setCookie:function(name,value,expires,onSuccess,onFailure){
    this._db.transaction(function(tx) {
      var datetime = this._formatDateTimeFromDate(expires);
      var str = JSON.stringify({value:value});
      tx.executeSql("replace into cookies (name,value,expires) values(?,?,?)", [name,str,datetime],onSuccess,function(){
        console.log('cookie set failed',arguments);
      });
    }.bind(this));
  },
  /**
   * Removes a cookie from the DB.
   * @param {String} name - cookie name to set / get
   * @param {Function} onSuccess - cookie removal onSuccess callback
   */
  unsetCookie:function(name,onSuccess){
    this._db.transaction(function(tx) {
      tx.executeSql("delete from cookies where name = ?", [name],onSuccess,function(){
        console.log('cookie unset failed',arguments);
      });
    });
  },
  /**
   * Clears all cookies from DB on extension uninstall
   */
  clearData:function(){
  	this._db.transaction(function(tx) {
  		tx.executeSql("drop table cookies", [],function(){},function(){
        console.log('cookies clearing failed',arguments);
      });
    });
  },
  /**
   * Formats a date object into a datetime string YYYY-MM-DD HH:MM:SS
   * @param {Date} datetime - date to formate
   * @returns {String} datetime formatted string
   */
  _formatDateTimeFromDate:function(datetime){
  	datetime = new Date(datetime);
    var month = datetime.getMonth() + 1, day = datetime.getDate();
    var hours = datetime.getHours(), mins = datetime.getMinutes(), secs = datetime.getSeconds();
    if(month < 10){
      month = "0"+month.toString();
    }
    if(day < 10){
    	day = "0"+day.toString();
    }
    if(hours < 10){
    	hours = "0"+hours.toString();
    }
    if(mins < 10){
    	mins = "0"+mins.toString();
    }
    if(secs < 10){
    	secs = "0"+secs.toString();
    }
    return [[datetime.getFullYear(),month,day].join('-'),[hours,mins,secs].join(':')].join(' ')
  },
  /**
   * Converts a datetime string into a Date object.
   * @param {String} str - datetime string to format
   * @returns {Date} Date object
   */
  _formatDateFromDateTime:function(str){
    var parts = str.split(' ');
    var date = parts[0].split('-');
    var time = parts[1].split(':');
    return new Date(date[0],parseInt(date[1])-1,date[2],time[0],time[1],time[2]).getTime();
  }
}