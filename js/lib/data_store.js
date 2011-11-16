/** SQLite Data Store */
var DataStore = {
  _db:null, //internal reference to DB object
  /**
   * Initialize the data store.
   * Prepare the data table if it doesnt exist.
   * @param {String} appID - crossrider app ID
   */
  init:function(appID){
    var now = new Date();
    this._db = openDatabase('crossrider_data_'+appID, 1, 'Crossrider Data Store', 10 * 1024 * 1024);
    this._db.transaction(function(tx) {
      tx.executeSql("create table if not exists extension_code(data_type varchar(255) primary key, value longtext, app_id integer, version varchar(10), updated_at datetime default (datetime('now','localtime')))", [], function(){}, function(){
      	console.log('table create error', arguments);
      });
    });
  },
  /**
   * Get extension data from the DB
   * @param {String} appID - application ID to load the data for
   * @param {Function} callback - callback to execute on the Background Page once data is read
   */
  getData:function(appID,callback){
    this._db.transaction(function(tx) {
      tx.executeSql("select data_type,value,version from extension_code where app_id = ?", [appID],function(tx, results){
        var data = {};
        for (var i = 0; i < results.rows.length; i++) {
          var row = results.rows.item(i);
          data[row.data_type] = {value:row.value,version:row.version};
        }
        callback(data);
      }.bind(this),
      function(){
      	console.log('data load error', arguments);
      });
    }.bind(this));
  },
  /**
   * Saves extension app data to the DB
   * @param {String} appID - application ID to save the data for
   * @param {String} app - extension's user script
   * @param {String} version - app version
   * @param {Function} successCallback - optional success callback
   */
  saveApp:function(appID, app, version, successCallback){
    this._db.transaction(function(tx) {
      	tx.executeSql("replace into extension_code (app_id, data_type, value, version, updated_at) values(?, 'app',?,?,datetime('now'))", [appID,app,version],
			function(){ // success callback
				if (typeof(successCallback) === 'function') successCallback();
			},
			function(){ // error callback
				console.log('app save error', arguments);
			}
		);
    });
  },
  /**
   * Saves extension BG script to the DB
   * @param {String} appID - application ID to save the data for
   * @param {String} bg_script - extension's BG script
   * @param {String} version - BG script version
   * @param {Function} successCallback - optional success callback
   */
  saveBGApp:function(appID, bg_script, version, successCallback){
    this._db.transaction(function(tx) {
    	tx.executeSql("replace into extension_code (app_id, data_type, value, version, updated_at) values(?, 'bg_script',?,?,datetime('now'))", [appID,bg_script,version],
			function(){ // success callback
				if (typeof(successCallback) === 'function') successCallback();
			},
			function(){ // error callback
      			console.log('app save error', arguments);
      		}
		);
    });
  },
  /**
   * Saves extension manifest to the DB
   * @param {String} appID - application ID to save the data for
   * @param {String} manifest - extension's manifest XML
   * @param {Function} successCallback - optional success callback
   */
  saveManifest:function(appID, manifest, successCallback){
    this._db.transaction(function(tx) {
      	tx.executeSql("replace into extension_code (app_id, data_type, value, updated_at) values(?, 'manifest',?,datetime('now'))", [appID,manifest],
			function(){ // success callback
				if (typeof(successCallback) === 'function') successCallback();
			},
			function(){ // error callback
      			console.log('manifest save error', arguments);
      		}
		);
    });
  },
  /**
   * Clears extension data on uninstall
   */
  clearData:function(appID){
  	this._db.transaction(function(tx) {
      tx.executeSql("drop table extension_code", [],function(){},function(){
      	console.log('extension data clear error', arguments);
      });
    });
  }
}