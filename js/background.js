/**** Global Javascript Extending ****/
/**
 * Adds delayed function execution.
 * @param {Number} ms - delay in milliseonds
 * @param {Object} scope - function execution scope
 * @param {Array} params - params to pass to the function
 * 
 * @returns setTimeout interval ID
 */
Function.prototype.delay = function(ms,scope,params){
  var _this = this;
  var f = function(){
    _this.apply(scope,params);
  };
  return setTimeout(f,ms);
}

/**
 * Adds periodical function execution.
 * @param {Number} ms - delay in milliseonds
 * @param {Object} scope - function execution scope
 * @param {Array} params - params to pass to the function
 * 
 * @returns setInterval interval ID
 */
Function.prototype.periodical = function(ms,scope,params){
  var _this = this;
  var f = function(){
    _this.apply(scope,params);
  };
  return setInterval(f,ms);
}

/** supress JS errors on background page **/
window.onerror = function(msg,file,line){
  console.log("JAVASCRIPT ERROR");
  console.log("ERROR MESSAGE:",msg);
  console.log("ON FILE: ",file," IN LINE NUMBER ",line);
  return false;
}

var Crossrider = {
  manifest:{},
  _tabs:{},
  debug:false,
  _userCode:'',
  _bgCode:'',
  _faye:{
  	client:null,
  	callbacks:{
  		'background':{}
  	},
  	asyncCallbacks:{}
  },
  _contextMenus:{},
  _cookies:{
  	mysite:{}
  },
  _notifications:{},
  _openedURL:null,
	_cookieInUpdate:{},
  _firstLoad:false,
  UPDATE_INTERVAL:360, // 6 hours (in minutes)
  /**
   * Initialize the Crossrider Background page Object
   */
  init:function(){
  	this._loadLocalManifest();
    this._initInternalMessaging();
    this._initStorage();
	// TODO (SHAYD) : chrome.management.onUninstalled is the only function that we call from chrome.management
	// and now we don't need it, we have empty callback there
	// for using it we are asking for the "management" permision on the manifest.json
	// we can remove the function and the permission from the manifest.json
    chrome.management.onUninstalled.addListener(this._onUninstall.bind(this));
    chrome.tabs.onRemoved.addListener(function(tabID, removeInfo) {
    	this._unsubscribeAllInTab(tabID);
    }.bind(this));
    chrome.tabs.onSelectionChanged.addListener(this._onTabSelectionChanged.bind(this));
  },
  /**
   * if installation time didn't exist on db, save now() as the installation time
   * @param {Integer} {optional} currentTime will be the InstallationTime if passed
   * @param {Function} {optional} success callback
   */
  _setInstallationTime:function(currentTime, callback){
		// try to get installation time from db
		var installationTime = this._cookies["InstallationTime"];
		// if it's not exist set now() as the installation time
		if (typeof(installationTime) === "undefined") {
			installationTime = currentTime || Math.round((new Date()).getTime() / 1000);
			// save installation time to the db
			var expTimestamp = new Date(2030, 1, 1, 0, 0, 0, 0);
			this.setCookie("InstallationTime", installationTime, expTimestamp, undefined, callback);
		}
  },
  /**
   * Initializes SQLite storage objects for cookies and user script
   */
  _initStorage:function(){
    CookieStore.init(this.appID);
    DataStore.init(this.appID);
    CookieStore.getCookies(this._onCookiesRead.bind(this));
  },
  /**
   * Callback for successful cookie read transaction from the SQLite CookieStore.
   * @param {Object} cookies - cookies object read from the Cookie Store
   */
  _onCookiesRead:function(cookies){
    this._cookies = cookies || {};
    this._cookies.mysite = {};
        
    this._startApplication();
  },
  /**
   * Starts the application loading process.
   * Loads the local extension manifest and user scripts.
   * The manifest is used to add specific information about the extension such as debug mode and user script entry point
   */
  _startApplication:function(){
    if(this.debug){
    	this._loadRemoteManifest();
    	this._getSiteCookies();
    } else {
    	DataStore.getData(this.appID,this._onAppDataLoad.bind(this));
    }
  },
  /**
   * Gets real cookies from authorized domain
   */
  _getSiteCookies:function(){
  	if(this.manifest['domain'] !== undefined && this.manifest.domain !== null){
	    chrome.cookies.getAll({url:'http://'+this.manifest.domain,domain:this.manifest.domain},function(cookies){
	      for(var i = 0, l = cookies.length; i < l; i++){
	        var c = cookies[i], expires = c.expirationDate !== undefined ? new Date(c.expirationDate * 1000).getTime() : null;
	        this._cookies.mysite[c.name] = {value:c.value,expires:expires};
	      }
	      this.setToolbarUniqueID();
	    }.bind(this));
  	} else {
  		this.setToolbarUniqueID();
  	}
  },
  /**
   * Initializes the BG page appAPI after the manifest and 
   */
  _initAppAPI:function(){
    // init BG page version of appAPI
    window.appAPI = new AppApi();
    window.appAPI.init(this._cookies);
    chrome.cookies.onChanged.addListener(this._onCookieChange.bind(this));
    this._fb_bridge = FBBridge.init(this.manifest.remotefbapiurl,this.appID,false);
  	this._loadUserScript();
  	this._loadBackgroundScript();
    this._firstLoad = localStorage['firstLoad'] !== "false";

	var _self = this;
	
    // this will make sure that we always have InstallationTime, new installation, updated
	if (this._firstLoad) {
		this._setInstallationTime(undefined, function() {
			if (_self.debug) return;
			_self._reportInstall();
			_self._reportUpdate();
			_self._sendDailyStats();
		});
		
		if(!this.debug) {
			this._showThankyouPage(); //we show the thank you page only the first time the app is installed and loaded
			localStorage['firstLoad'] = "false";				
		}
	}
		
  	if(!this.debug){
	  	this._checkNextUpdate.periodical(60 * 1000, this); // call _checkNextUpdate every 1 min
  	}
  },
  /**
   * Callback for app data load from SQLite DataStore.
   * If the application data exists in the local data store, the app will be loaded with that data.
   * Otherwise, the data will be loaded from Crossrider servers, saved to the local data store and then loaded into the application
   */
  _onAppDataLoad:function(data){
  	var current_crx_version = localStorage['crx_version'];
  	if(data.manifest && data.app && current_crx_version === this.manifest.version){
  		this._parseManifestXML(data.manifest.value);
  		this._user_script = data['app'] || {value:'',version:this.manifest.ver};
  		this._bg_script = data['bg_script'] || {value:'',version:this.manifest.backgroundver};
		this._getSiteCookies();
  	} else {
		var isNeedToLoadSiteCookies = true;
		var isInstalled = this._updateAppAndManifest(isNeedToLoadSiteCookies);
		if (!isInstalled) {
			setTimeout(function() {
				Crossrider._onAppDataLoad(data);
			}, 60 * 1000);
		} else {
			// we don't call it anymore from here because we call it from _updateAppAndManifest
			// this._getSiteCookies();
		}
  	}
  },
  /**
   * Loads the local (JSON) manifest file
   */
  _loadLocalManifest:function(){
  	var url = chrome.extension.getURL('manifest.json');
    var s = url.replace(/chrome\-extension\:\/\//,'');
    this.extensionID = s.substr(0,s.indexOf('/'));
    this.manifest = JSON.parse(Crossrider.Utils.fetchScript(url));
    this.manifest.platform = "CH";
    this.debug = this.manifest.crossrider.hasOwnProperty('debug') ? this.manifest.crossrider.debug : false;
    this.appID = this.manifest.crossrider.appID;
  },
  /**
   * Loads the application's remote manifest XML file
   * @returns {String} xml manifest
   */
  _loadRemoteManifest:function(){
	var manifestUrl = 'http://app-static.crossrider.com/plugin/apps/manifest/'+this.appID+'.xml'; // default manifest url
	// if we have in the manifest file "link" (redirect) to another manifest file -> we should use the "new" manifest file
	if (this.manifest && this.manifest.manifest) {
		manifestUrl = this.manifest.manifest;
	}
	// get the manifest.xml and parse it
	var xml = Crossrider.Utils.fetchScript(manifestUrl);
	if (xml) {
		this._parseManifestXML(xml);	
	}

	return xml;
  },
  /**
   * Loads application manifest and javascript from Crossrider servers.
   * Used for initial app loading / app code updating
   */
	// TODO (SHAYD) : in the near future we need to refactor this function
  _updateAppAndManifest:function(isNeedToLoadSiteCookies){
  	var xml = this._loadRemoteManifest();
	if (!xml) {
		return false;
	}
	
  	var ver = Crossrider.Utils.toInt(this.manifest.ver), bg_ver = Crossrider.Utils.toInt(this.manifest.backgroundver);
  	var old_ver = this._user_script ? Crossrider.Utils.toInt(this._user_script.version) : 0;
  	var old_bg_ver = this._bg_script ? Crossrider.Utils.toInt(this._bg_script.version) : 0;
  	var update_app = ver > old_ver, update_bg_app = bg_ver > old_bg_ver;
	var _self = this;
  	DataStore.saveManifest(this.appID, xml, function() {
		if(localStorage['crx_version'] === undefined || localStorage['crx_version'] !== _self.manifest.version){
	  		localStorage['crx_version'] = _self.manifest.version;
	  	}

		function getScript(script_url, cb) {
			// alert("Trying to fetch " + script_url);
			var script = Crossrider.Utils.fetchScript(script_url);
			if (!script) {
				setTimeout(function() {
					getScript(script_url, cb);
				}, 60 * 1000);
			} else {
				cb(script);
			}
		};
		
		function saveAndReloadBg(bg_script, cb) {
			DataStore.saveBGApp(_self.appID, bg_script, _self.manifest.backgroundver, function() {
				_self._bg_script = {value:bg_script, version:_self.manifest.backgroundver};
				if (cb) {
					cb(reloadBg);
				} else {
					reloadBg();
				}
			});

		};
		
		function reloadBg() {
			if (_self._bg_script !== undefined) {
				self.location.reload();
			}
		};
	
		function updateBgAppCode(cb) {
			if (_self.manifest.backgroundjs) {
				getScript(_self.manifest.backgroundjs, function(bg_script) {
					saveAndReloadBg(bg_script, cb);
				});
			} else {
				var bg_script = '';
				saveAndReloadBg(bg_script, cb);
			}
		};
		
		function saveNewAppCode(user_script, cb) {
			// alert("save new app code");
			_self._user_script = {value:user_script,version:_self.manifest.ver};
			_self._loadUserScript();
			if (!isNeedToLoadSiteCookies) {
				_self._reportUpdate(old_ver);
			}
			DataStore.saveApp(_self.appID, user_script, _self.manifest.ver, function() {
				// if (update_bg_app) {
				// 		updateBgAppCode();
				// }
				if (cb) {
					cb();
				}
			});
		};
	
		// we should call _getSiteCookies is we updated the app code
		// if we updated the bg code, we are doing reload to the bg page that will call _getSiteCookies
		if(update_app){
			getScript(_self.manifest.jslink, function(user_script) {
				if (update_bg_app) {
					updateBgAppCode(function(cb) {
						saveNewAppCode(user_script, function() {
							if (isNeedToLoadSiteCookies) {
								// _self._getSiteCookies();
							}
							
							if (cb) {
								cb();
							}
						});
					});
				} else {
					saveNewAppCode(user_script, function() {
						if (isNeedToLoadSiteCookies) {
							_self._getSiteCookies();
						}
					});
				}
			});
	  	} else if(update_bg_app){
	    	updateBgAppCode(function(cb) {
				if (isNeedToLoadSiteCookies) {
					// _self._getSiteCookies();
				}
				
				if (cb) {
					cb();
				}
			});
		}
	});
	
	return true;
  },
  /**
   * Parses application manifest XML file and adds its properties to the manifest JSON object
   * @param {String} xml - xml string to parse
   */
  _parseManifestXML:function(xml){
    var dp = new DOMParser();
    xDoc = dp.parseFromString(xml, "text/xml");
    var nodes = xDoc.getElementsByTagName('CrAppInfo')[0].childNodes;
    for(var i = 0, l = nodes.length; i < l; i++){
    	var node = nodes[i];
    	if(node && node.nodeType === 1){
    		this.manifest[node.nodeName.toLowerCase()] = node.childNodes.length > 0 ? (node.childNodes[0].nodeValue === 'NA' ? null : node.childNodes[0].nodeValue) : null;
    	}
    }
    
    // If we have UpdateInterval in the manifest convert it to int
    if(this.manifest.hasOwnProperty("updateinterval")) {
    	this.manifest.updateinterval = parseInt(this.manifest.updateinterval);
    } else { // we don't have UpdateInterval, we will default to 6 hours (360m)
    	this.manifest.updateinterval = this.UPDATE_INTERVAL;
    }
    
		// if we have 'update interval' in the xml file, save it
		// if (this.manifest.updateinterval !== undefined) {
		// 	this._updatesInterval = this.manifest.updateinterval * 60; // in the xml file it's in minutes
		// 	delete this.manifest.updateinterval;
		// }
  },
  /**
   * Initialize internal onRequest event listener to handle
   * messages from the content script.
   */
  _initInternalMessaging:function(){
    chrome.extension.onRequest.addListener(this._onRequest.bind(this));
  },
  /**
   * onRequest event handler for requests from the content script.
   * Looks for an internal method that corresponds to @param request.action.
   * If such method is found, it will be executed, with @param.request.params passed as arguments
   * 
   * @param {Object} request - Request data object. holding data passed from the sender
   * @param {Object} sender - Request sender reference
   * @param {Function} sendResponse - callback to execute when the request is received;
   */
  _onRequest:function(request, sender, sendResponse){
    var action = request['action'];
    if(action && typeof(this[action]) === 'function'){
      var params = request['params'] && typeof(request['params']['push']) === 'function' ? request['params'] : [];
      if(request.passCallback === true){
        params.push(sendResponse);
      }
      if(action === 'addUserScripts'){
	      params.push(sender.tab);
      }
      this[action].apply(this,params);
    }
    if(!request.passCallback && sendResponse && typeof(sendResponse) === 'function'){
      sendResponse();
    }
  },
  /**
   * Loads Background script from file to be executed in the background page's context
   */
  _loadBackgroundScript:function(){
  	if(this.debug){
	  	var bg_script_url = chrome.extension.getURL(this.manifest.crossrider.background_script);
	    this._bg_script = {value:Crossrider.Utils.fetchScript(bg_script_url),version:this.manifest.backgroundver};
	  }
	  if(this._bg_script !== undefined){
	    this._bgCode = Crossrider.CodeParser.parse(this._bg_script.value);
		  Crossrider.Workers.execLocal(this._bgCode,'background_script');
	  }
  },
  /**
   * Loads the User Scripts into the extension's background page
   */
  _loadUserScript:function(){
    if(this.debug){
	    Crossrider.Workers.reset();
      	var user_script_url = chrome.extension.getURL(this.manifest.crossrider.user_script);
      	var user_script = Crossrider.Utils.fetchScript(user_script_url);
      	this._parseUserScripts(user_script);
    } else {
    	this._parseUserScripts(this._user_script.value);
    }
  },
  /**
   * Parses User Scripts.
   * 
   * @param {String} user_script - the application's code to parse
   * 
   */
  _parseUserScripts:function(user_script){
    this._userCode = Crossrider.CodeParser.reset().parse(user_script);
    Crossrider.Workers.types.forEach(function(type){
      var workers = Crossrider.Workers[type];
      for(var worker in workers){
        if(workers.hasOwnProperty(worker)){
          var w = workers[worker];
          w.code = Crossrider.CodeParser.parse(w.code);
        }
      }
    });
    Crossrider.Workers.start();
  },
  /**
   * Loads user scripts into an open tab in browser.
   * Called by a content script when it loads into a new tab
   * @param {Object} tab - the tab tht requested the script
   */
  addUserScripts:function(tab){
    if(this.debug){
      // here we reload the user scripts every time a content script is added to a page
      // to allow for auto refreshing of code during development
      this._loadUserScript();
    }
    var styles = Crossrider.CodeParser.includes.DOM.css;
    if(!tab.selected){
    	this._tabs[tab.id] = true;
    	return;
    }
    chrome.windows.getLastFocused(function(win){
			if(win.type === 'popup' && (win.tabs === undefined || win.tabs.length === 0)){
				return;
			}
			if(this._cookies.mysite === undefined){
				this._cookies.mysite = {};
			}
			// if tab.id doesn't exist the callback will be called with tab as undefined
			// and an error will be shown on the console: "Error during tab.get: No tab with that id: (tab.id)."
	    chrome.tabs.get(tab.id, function(tab) {
			// if the tab does not exist we will not run the code on this page
			if (!tab) return;
    		var regexp = /^(https\:\/\/ssl|www\.facebook\.com\/login\.php|https\:\/\/www\.facebook\.com\/connect\/uiserver\.php|http\:\/\/static\.ak\.fbcdn\.net\/connect\/xd_proxy\.php).*/;
	    	// if we are not on facebook and we are on http/https page
			if(!tab.url.match(regexp) && tab.url.indexOf("http") == 0){
		      chrome.tabs.sendRequest(tab.id, {action: 'initContentScript', params:[styles,JSON.stringify(this._cookies),tab.id,this._bic,this.manifest]}, function() {
				// if we have the code
				if (typeof this._userCode == "string" && this._userCode.length > 0) {
		        	chrome.tabs.executeScript(tab.id,{code:this._userCode});	
				}
		      }.bind(this));
	    	}
	    }.bind(this));
  	}.bind(this));
  },
  /**
   * Handles tab selection change events.
   * Executes app script on focused tabs as they focus to ensure
   * the script is run in the right tab rather than the current tab
   * @param {Integer} tabId - selected tab ID
   * @param {Object} selectInfo - window and tab selection info
   */
  _onTabSelectionChanged:function(tabId,selectInfo){
  	if(this._tabs.hasOwnProperty(tabId)){
  		delete this._tabs[tabId];
  		this.addUserScripts({id:tabId,selected:true});
  	}
  },
  /**
   * Handles XHR requests from appAPI and Crossrider.
   * @param {Object} options - XHR options object
   *    url {String} - request URL
   *    method {String} - request method (get/post)
   *    data {String} - request data query-string
   *    onSuccess {Function} - XHR on success callback
   * 
   * @returns {String} - xhr response (sync) or undefined (async)
   */
  request:function(options,callback){
    var async = options.async === undefined ? true : options.async;
    var xhr = new XHR({
      url:options.url,
      method:options.method,
      data:options.data,
      callback:callback,
      async:async
    });
    return xhr.send();
  },
  /**
   * Opens a new URL specified by 'url' in a current/new tab or new window
   * @param {String} url - URL to open
   * @param {String} where - where to open the URL (current / new tab or new window). Possible values are: 'current', 'tab', 'window'
   */
  openURL:function(url,where){
  	if(this._openedURL !== null){
  		this._openedURL = null;
  	} else {
	    if(where === 'current'){
	    	chrome.tabs.getSelected(null, function(tab) {
				if (!tab) return;
	    		chrome.tabs.update(tab.id,{url:url});
	    	});
	    } else {
	      chrome[where === 'tab' ? 'tabs' : 'windows'].create({
	        url:url
	      });
	    }
	    this._openedURL = url;
  	}
  },
  /**
   * Alerts a string 'str'
   * @param {String} str - string to alert
   */
  superAlert:function(str){
    alert(str);
  },
  
  /** Messaging functionality with Faye **/
  /**
   * Creates a Faye client and connects to Crossrider messaging server
   */
  connect:function(callback){
    if (this._faye.client === null){
      this._faye.client = new Faye.Client('http://push.crossrider.com:8000/faye', {
        timeout: 120
      });
    }
    if(typeof(callback) === 'function'){
	    callback();
    }
  },
  /**
   * Publishes a message to the Crossrider Faye server using a Faye client
   * @param {String} channel - the channel to connect to
   * @param {String} data - the data to pass in the message
   */
  publish:function(channel, data) {
    if(typeof(data) !== 'string'){
      if(data['hasOwnProperty'] && !data['length']){
        data = JSON.stringify(data);
      } else {
        data = data.toString();
      }
    }
    this._faye.client.publish(this._getChannelURL(channel), data);
  },
  /**
   * Subscribes to a Faye messaging channel
   * @param {String} channel - channel to subscribe to
   * @param {Function} callback - callback to handle subscriptions
   * @param {Integer} tabID - subscribing tab ID (optional)
   * @param {Boolean} async - if set to true, callback will be registered on behalf of the async API rather than content script
   */
  subscribe:function(channel,callback,tabID,async) {
  	if(typeof(callback) === 'function'){
  		if(!this._faye.callbacks['background'][channel]){
  			this._faye.callbacks['background'][channel] = this._faye.client.subscribe(this._getChannelURL(channel), callback);
  		}
  		return this._faye.callbacks['background'][channel];
  	} else {
  		var obj = async ? 'asyncCallbacks' : 'callbacks';
  		if(!this._faye[obj][tabID]){
  			this._faye[obj][tabID] = {};
  		}
  		if(!this._faye[obj][tabID][channel]){
	  		this._faye[obj][tabID][channel] = this._faye.client.subscribe(this._getChannelURL(channel), function(msg){
	        chrome.tabs.sendRequest(tabID, {action: 'respond', params:[channel,msg,async]}, function() {});
		    });
  		}
  		return this._faye[obj][tabID][channel];
  	}
  },
  /**
   * Unsubscribes from a Faye messaging channel
   * @param {String} channel - channel to subscribe to
   * @param {Integer} tabID - subscribing tab ID
   * @param {Boolean} async - if set to true, call is made on behalf of async API rather than appAPI
   */
  unsubscribe:function(channel,tabID,async) {
  	var obj = async ? 'asyncCallbacks' : 'callbacks';
  	if(this._faye[obj][tabID][channel]){
  		this._faye[obj][tabID][channel].cancel();
  		delete this._faye[obj][tabID][channel];
  	}
  },
  /**
   * Removes all faye callbacks in a specific tab.
   * Called when a tab is closed
   */
  _unsubscribeAllInTab:function(tabID){
  	if(this._faye.callbacks[tabID]){
  		for(var c in this._faye.callbacks[tabID]){
  			if(this._faye.callbacks[tabID].hasOwnProperty(c)){
  				this.unsubscribe(c,tabID);
  			}
  		}
  		delete this._faye.callbacks[tabID];
  	}
  	if(this._faye.asyncCallbacks[tabID]){
  		for(var c in this._faye.asyncCallbacks[tabID]){
  			if(this._faye.asyncCallbacks[tabID].hasOwnProperty(c)){
  				this.unsubscribe(c,tabID,true);
  			}
  		}
  		delete this._faye.asyncCallbacks[tabID];
  	}
  },
  /**
   * Constructes a Faye channel URL unique to the extension by appending the extension ID as a prefix.
   * @param {String} channel - channel name
   * 
   * @returns {String} Faye channel URL
   */
  _getChannelURL:function(channel){
  	var prefix = (this.debug ? 'Debug' : '') + 'app';
    return ['/',prefix,this.appID,'ZZZ-',channel].join('');
  },
  /**
   * Saves a cookie in the local cookie object and SQLite cookie DB.
   * Called whenever a cookie is updated in one of the tabs and sends an updated cookie to all active tabs.
   * @param {String} name - cookie name to set
   * @param {String} value - cookie value to set
   * @param {Date} expires - cookie expiration date
   * @param {String} tabID - the ID of the tab that requested the cookie update
   * @param {Function} callback - optional success callback
   */
  setCookie:function(name,value,expires,tabID,callback){
    if(name === 'mysite'){ return; }
    var now = new Date().getTime(), expires = new Date(expires).getTime();
    if(now > expires){
      if(this._cookies[name]){
        this.unsetCookie(name);
      }
    } else {
      CookieStore.setCookie(name,value,expires,function(){
        this._cookies[name] = {value:value,expires:expires}; 
        this._broadcastAllTabs('updateCookie',[name,this._cookies[name]],tabID);
		if (callback) {
			callback();
		}
      }.bind(this),
      function(){
        this._broadcastAllTabs('unsetCookie',[name]);
      }.bind(this));
    }
  },
  /**
   * Removes a cookie from the local storage object and updates all active tabs about the removal.
   * @parma {String} name - cookie to remove
   */
  unsetCookie:function(name){
    if(this._cookies[name]){
      CookieStore.unsetCookie(name,function(){
        delete this._cookies[name];
        this._broadcastAllTabs('unsetCookie',[name]);
      }.bind(this));
    }
  },
  /**
   * Saves a browser cookie.
   * Called whenever a browser cookie is updated via appAPI.mysite.cookie in one of the tabs and sends an updated cookie to all active tabs.
   * @param {String} name - cookie name to set
   * @param {String} value - cookie value to set
   * @param {Date} expires - cookie expiration date
   */
  setRealCookie:function(name,value,expires){
  	if(this.manifest['domain'] !== undefined && this.manifest.domain !== null){
	    var now = new Date().getTime(), exp = expires ? new Date(expires).getTime() : null;
	    if(exp !== null && now > exp){
	      if(this._cookies.mysite[name]){
	        this.unsetRealCookie(name);
	      }
	    } else {
	      if(exp !== null){
	        chrome.cookies.set({url:'http://'+this.manifest.domain,name:name,value:value,expirationDate:Math.round(exp / 1000),path:'/'});
	      } else {
	        chrome.cookies.set({url:'http://'+this.manifest.domain,name:name,value:value,path:'/'});
	      }
	      this._cookies.mysite[name] = {value:value,expires:exp};
	      //this._broadcastAllTabs('updateRealCookie',[name,this._cookies.mysite[name]]);
	    }
  	}
  },
  /**
   * Removes a browser cookie from the local cookies object and updates all active tabs about the removal.
   * @parma {String} name - cookie to remove
   */
  unsetRealCookie:function(name){
  	if(this.manifest['domain'] !== undefined && this.manifest.domain !== null){
	    if(this._cookies.mysite[name]){
	      chrome.cookies.remove({url:'http://'+this.manifest.domain,name:name});
	      delete this._cookies.mysite[name];
	      //this._broadcastAllTabs('unsetRealCookie',[name]);
	    }
	  }
  },
  /**
   * Handles browser cookie changes.
   * @param {Object} obj - cookie changes object
   *    - removed {Boolean} - denotes cookie was removed
   *    - cookie {Object} - cookie data object
   */
  _onCookieChange:function(obj){
  	if(this.manifest['domain'] === undefined || this.manifest.domain === null || obj.cookie.domain.indexOf(this.manifest.domain) < 0){
  		return;
  	} else {
	    if(obj.removed){
	    	if(this._cookies.mysite[obj.cookie.name] !== undefined){
		    	delete this._cookies.mysite[obj.cookie.name];
		    	//this._broadcastAllTabs('unsetRealCookie',[obj.cookie.name], true);
	    	}
	    } else {
	    	var exp = obj.cookie.expirationDate ? obj.cookie.expirationDate * 1000 : null;
	    	var now = new Date().getTime();
	    	if((exp !== null && now > exp) || obj.cookie.session){
	    		exp = null;
	    	}
	    	this._cookies.mysite[obj.cookie.name] = {value:obj.cookie.value,expires:exp};
	    	//this._broadcastAllTabs('updateRealCookie',[obj.cookie.name,obj,this._cookies.mysite[obj.cookie.name]], true);
	    }
  	}
  },
  /**
   * Sends a broadcast to all open tabs with action to perform and params to pass to that action.
   * Used for example to notify all tabs about cookie changes
   * @param {String} action - action to call on each open tab
   * @param {Array} params - params to pass to the called action
   * @param {String} tabID - optional tab ID to exclude from broadcast
   * @param {Boolean} force - force broadcast to all tabs, ignoring tabID
   */
  _broadcastAllTabs:function(action,params,tabID, force){
    chrome.windows.getAll({populate:true},function(wins){
      wins.forEach(function(w){
        w.tabs.forEach(function(tab){
        	if(force || tabID === undefined || (tabID !== undefined && tabID !== tab.id)){
	          chrome.tabs.sendRequest(tab.id,{action:action,params:params});
        	}
        });
      });
    });
    window.appAPI[action].apply(appAPI,params);
  },
  /**
   * Handles messages from appAPI.message. Sends messages to tabs or background page listeners
   * @param {String} type - message type (active / all / background)
   * @param {Object} msg - message object
   * @param {Number} tabID - calling tab id (or null if called from background page)
   */
  message:function(type,msg,tabID){
  	switch(type){
  		case 'active':
	  		chrome.tabs.getSelected(null, function(tab) {
		      if(tab && tab.url.indexOf('http') === 0){
		      	chrome.tabs.sendRequest(tab.id,{action:'handleMessage',params:[msg]});
		      }
		    });
  			break;
  		case 'all':
  			chrome.windows.getAll({populate:true},function(wins){
		      wins.forEach(function(w){
		        w.tabs.forEach(function(tab){
		          chrome.tabs.sendRequest(tab.id,{action:'handleMessage',params:[msg]});
		        });
		      });
		    });
  			break;
  		case 'background':
  			window.appAPI.message.call(msg);
  			break;
  	}
  },
  /*** Browser Action API ***/
  /**
	 * Sets browser action badge text
	 * @param {String} text - badge text to set
	 */
	setBadgeText:function(text){
		chrome.browserAction.setBadgeText({text:text});
	},
	/**
	 * Sets browser action badge BG color
	 * @param {Array} color - background color array (RGBA). For example: [255,0,0,1]
	 */
	setBadgeBackgroundColor:function(color){
		chrome.browserAction.setBadgeBackgroundColor({color:color});
	},
	/**
	 * Sets browesr action icon. User can choose from a set list of icons provided by Crossrider
	 * @param {String} icon - icon to set from icon list. For example icon1.png
	 */
	setIcon:function(icon){
		var iconURL = chrome.extension.getURL('icons/actions/'+(icon || 'icon1')+'.png');
		chrome.browserAction.setIcon({path:iconURL});
	},
	/**
	 * Enables browser action popup
	 */
	enablePopup:function(){
		chrome.browserAction.setPopup({popup:'popup.html'});
	},
	/**
	 * Disables browser action popup
	 */
	disablePopup:function(){
		chrome.browserAction.setPopup({popup:''});
	},
	/**
	 * Sets the browser action title (tooltip)
	 * @param {String} title - title to set
	 */
	setTitle:function(title){
		chrome.browserAction.setTitle({title:title});
	},
  /**
   * Gets a unique ID for the extension from 'bic' cookie on the crossrider domain.
   * If no such cookie exists, its created and saved on the crossrider domain
   * @param {Function} callback - callback to run in case setToolbarUniqueID is called from content script
   */
  setToolbarUniqueID:function(callback){
  	if(localStorage['bic']){
  		this._bic = localStorage['bic'];
  		if(typeof(callback) === 'function'){
  			callback(this._bic);
  		} else {
	  		this._initAppAPI();
  		}
  	} else {
	  	chrome.cookies.get({url:'http://www.crossrider.com',name:'bic'},function(cookie){
	  		if(cookie && cookie.value){
	  			localStorage['bic'] = this._bic = cookie.value;
	  		} else {
	  			localStorage['bic'] = this._bic = Crossrider.Utils.getUID();
			  	var now = new Date();
			  	var diff = 1000 * 60 * 60 * 24 * 365 * 10; //10 years
			  	var expires = new Date(now.getTime() + diff);
					chrome.cookies.set({
						url:'http://www.crossrider.com',
						domain:'www.crossrider.com',
						name:'bic',
						value:this._bic,
						path:'/',
						expirationDate:expires.getTime()
					});
	  			this._reportFirstInstall();
	  		}
				if(typeof(callback) === 'function'){
	  			callback(this._bic);
	  		} else {
		  		this._initAppAPI();
	  		}
	  	}.bind(this));
  	}
  },
  /**
   * Calls 'callback' with the value of the app ID
   * @param {Function} callback - callback to call with the value of this.appID
   */
  getAppID:function(callback){
  	callback(this.appID);
  },
  /**
   * Shows a thank you page to the user the first time the extension is installed
   * Called in case there is no application data in the local SQLite data store.
   */
  _showThankyouPage:function(){
  	// false - installer didn`t opened the thank you page
  	// true - installer opened the thank you page
    var installerThankYouPage = false;
    
    // If we InstallationThankYouPage in the db
    if( this._cookies.hasOwnProperty("InstallationThankYouPage") ) {
    	// And its value is true
    	if( this._cookies["InstallationThankYouPage"].value ) {
			installerThankYouPage = true; 	
    	}
    } 

   if(this.manifest.thanksurl && this._firstLoad && !installerThankYouPage){
  		chrome.tabs.create({
  			url:this.manifest.thanksurl
  		},function(){});
  	}
  },
  /**
   * Periodical check for the next cron update.
   * Check is done against a stored value of nextUpdate timestamp which is updated every time the dailyCron function runs
   */
  _checkNextUpdate:function(){
  	var now = new Date().getTime(),
  			nextUpdate = parseInt(localStorage['nextUpdate'] || now + (this.manifest.updateinterval * 60 * 1000));
  			
  	if(!localStorage['nextUpdate']){
  		localStorage['nextUpdate'] = nextUpdate;
  	}
  	
  	if(now >= nextUpdate){
  		this._dailyCron();
  	}
  },
  /**
   * Run daily scripts - app update and daily stats
   */
  _dailyCron:function(){
  	var isUpdated = this._updateAppAndManifest();
	if (isUpdated) {
		this._sendDailyStats();
	  	localStorage['nextUpdate'] = (new Date()).getTime() + (this.manifest.updateinterval * 60 * 1000);	
	} else {
		// if we didn't got the manifest succesfully we will try again in 1min from now
		setTimeout(function() {
			_dailyCron();
		}, 60 * 1000);
	}
  },
  /**
   * Send daily stats to crossrider
   */
  _sendDailyStats:function(){
  	var url = 'http://stats.crossrider.com/stats.gif?action=daily&'+this._getSharedQueryStringParametersForStats();
  	this._sendPixel(url);
  },
  /**
   * Report first installation of the crossrider Chrome extension api
   */
  _reportFirstInstall:function(){
  	var url = 'http://stats.crossrider.com/install.gif?'+this._getSharedQueryStringParametersForStats();
  	this._sendPixel(url);
  },
  /**
   * Report extension installation
   */
  _reportInstall:function(){
  	var url = 'http://stats.crossrider.com/apps.gif?action=install&'+this._getSharedQueryStringParametersForStats();
  	this._sendPixel(url);
  },
  /**
   * Report extension uninstall
   */
  _reportUninstall:function(){
  	var url = 'http://stats.crossrider.com/apps.gif?action=uninstall&'+this._getSharedQueryStringParametersForStats();
  	this._sendPixel(url);
  },
  /**
   * Report extension update
   */
  _reportUpdate:function(oldVer){
  	var url = 'http://stats.crossrider.com/apps.gif?action=update&'+this._getSharedQueryStringParametersForStats()+'&oldver='+oldVer;
  	this._sendPixel(url);
  },
  /**
  * Get common parameters for the query string for the stats requests
  */
  _getSharedQueryStringParametersForStats:function(){
  	var parts = this.manifest.version.split('.'), ver = [parts[0],parts[1]].join('.'), appver = this.manifest.ver;
		var curTimeInSeconds = Math.round((new Date()).getTime() / 1000);
		
		var installTimeInSeconds = Math.round((new Date()).getTime() / 1000);
		// If we don't have "InstallationTime" in the db we will set the installation time
		if(!this._cookies.hasOwnProperty("InstallationTime")) {
			this._setInstallationTime(installTimeInSeconds);
		} else {
			installTimeInSeconds = this._cookies["InstallationTime"].value;
		}
		
		// if it's not exist set now() as the installation time
		// if (typeof(this._cookies["InstallationTime"]) !== "undefined") {
		// 	installTimeInSeconds = this._cookies["InstallationTime"].value;
		// }
		var lifeTimeInSeconds = curTimeInSeconds - installTimeInSeconds;
		
		var parameters = 'browser=chrome&ver='+ver+'&bic='+this._bic+'&app='+this.appID+'&appver='+appver +
			'&installtime='+installTimeInSeconds+'&curtime='+curTimeInSeconds+'&lifetime='+lifeTimeInSeconds;
		
		return parameters;
  },
  /**
   * Handles extension uninstall. Clears all cookies and data and sends an uninstall report
   */
  _onUninstall:function(){
	// note: the cookie store, data store and localStorage will be deleted automatically (by chrome)
	
  	// this._reportUninstall();
	// SHAYD: 	I comment the "reportUninstall" function because this event is fired for EVERY extension that installed.
	// 			There is "feature request" for this issue on crbug.com (link below) and also a hacky way to catch this event.
	//			For now, we decided to leave it with no "report".
	// http://code.google.com/p/chromium/issues/detail?id=19383
	// http://keep12on.com/2011/05/26/detecting-extension-uninstallations-on-chrome/
	// http://code.google.com/chrome/extensions/faq.html#faq-lifecycle-events
  },
  /**
   * Send a report pixel to crossrider
   * @param {String} url - report URL
   */
  _sendPixel:function(url){
  	var body = document.getElementsByTagName('body')[0];
  	var img = document.createElement('img');
  	img.src = url;
  	img.onload = function(ev){
  		body.removeChild(this);
  	}
  	body.appendChild(img);
  },
  /**
   * Handles requests to the facebook bridge from content scripts
   * @param {String} tabId - calling tab ID
   * @param {String} action - facebook api action to perform
   * @param {Object} options - optional api action params
   */
  fb_bridge:function(tabId,action,options){
  	this._fb_bridge.exec(tabId,action,options);
  },
  /**
   * Shows a desktop notification
   * @param {String} title - notification title
   * @param {String} msg - message to show in the notification
   * @param {String} icon - notification icon URL. Defaults to icon1
   * @param {String} uid - notification unique identifier
   * @param {String} tabID -Id of the tab that called the notification
   */
  notification:function(title,msg,icon,uid, tabID){
		var iconUrl = icon || chrome.extension.getURL('icons/notifications/icon1.png');
  	var notification = webkitNotifications.createNotification(iconUrl, title, msg);
  	this._notifications[uid] = notification;
  	this.setNotificationEvents(notification,uid,tabID);
  	notification.show();
  },
  /**
   * Shows an HTML desktop notification
   * @param {String} url - URL of HTML page to show
   * @param {String} uid - notification unique identifier
   * @param {String} tabID -Id of the tab that called the notification
   */
  htmlNotification:function(url,uid,tabID){
  	var notification = webkitNotifications.createHTMLNotification(url);
  	this._notifications[uid] = notification;
  	this.setNotificationEvents(notification,uid,tabID);
  	notification.show();
  },
  /**
   * Hides a notification by a given UID
   * @param {String} uid - UID of the notification object in this._notifications
   */
  hideNotification:function(uid){
		var n = this._notifications[uid];
		if(n){
			n.cancel();
		}  	
  },
  /**
   * Adds event listeners to a notification object
   * @param {Object} notification - notification object to add events to
   * @param {String} uid - notification unique identifier
   * @param {String} tabID - optional ID of tab calling the notification
   */
  setNotificationEvents:function(notification,uid,tabID){
  	notification.addEventListener('display',function(){
  		if(tabID){
	  		chrome.tabs.sendRequest(tabID,{action:'handleNotificationEvent',params:['ondisplay',uid]});
  		} else {
  			appAPI.handleNotificationEvent('ondisplay',uid);
  		}
  	});
  	notification.addEventListener('close',function(){
  		if(tabID){
	  		chrome.tabs.sendRequest(tabID,{action:'handleNotificationEvent',params:['onclose',uid]});
  		} else {
  			appAPI.handleNotificationEvent('onclose',uid);
  		}
  		if(this._notifications[uid]){
  			delete this._notifications[uid];
  		}
  	}.bind(this));
  	notification.addEventListener('error',function(){
  		if(tabID){
	  		chrome.tabs.sendRequest(tabID,{action:'handleNotificationEvent',params:['onerror',uid]});
  		} else {
  			appAPI.handleNotificationEvent('onerror',uid);
  		}
  	});
  },
  /**
   * Reloads the Background Page
   */
  reload:function(){
  	self.location.reload();
  }
}

/**
 * Workers Object
 */
Crossrider.Workers = {
  DOM:{}, //DOM workers object
  BG:{}, //BG workers object
  timers:{
  	BG:null,
  	DOM:null
  },
  _storage:{
  	BG:{},
  	DOM:{}
  },
  types:['BG','DOM'], //Worker types - used for iterators
  /**
   * Starts the workers periodical timer. This timer will go over all available workers and check if they need to be run or not
   */
  start:function(){
  	this._getStoredRunTimes();
  	this._cleanUp();
  	this.types.forEach(function(type){
    	this.timers[type] = this._run.periodical(1000 * 60, this,[type]);
    }.bind(this));
  },
  /**
   * Runs all relevant workers by type.
   * Iterates over the typed worker object, finds workers that need to be run and executes them
   */
  _run:function(type){
  	var now = new Date().getTime();
  	for(var w in this[type]){
      if(this[type].hasOwnProperty(w)){
        var worker = this[type][w];
        if(worker.last_run === 0){
        	worker.last_run = now;
        }
        var runWorker = now - worker.last_run >= worker.interval * 1000 * 60 || now - worker.last_run === 0;
        if(runWorker){
        	this[type === 'DOM' ? '_exec' : 'execLocal'](worker.code,worker.name);
        	var last_run_time = new Date().getTime();
        	worker.last_run = last_run_time;
        	this._setLastRunTime(type,w,last_run_time);
        }
      }
    }
  },
  /**
   * Executes DOM worker code by calling executeScript on the current tab
   * @param {String} code - Javascript code to execute
   * @param {String} name - worker name
   */
  _exec:function(code,name){
    chrome.tabs.getSelected(null, function(tab) {
      if(tab && tab.url.indexOf('http') === 0){
        if(typeof(code) === 'string' && code.length > 0){
        	chrome.tabs.executeScript(tab.id,{code:code});
       	}
      }
    });
  },
  /**
   * Executes BG worker code by adding a script tag to the background page.
   * @param {String} code - Javascript code to execute
   * @param {String} name - worker name, used as suffix for script tag unique ID
   */
  execLocal:function(code,name){
    var body = document.getElementsByTagName('body')[0];
    var id = 'bg_worker_'+name;
    var oldWorker = document.getElementById(id);
    if(oldWorker){
      body.removeChild(oldWorker);
    }
    var tag = document.createElement('script');
    tag.setAttribute('type','text/javascript');
    tag.innerHTML = code;
    body.appendChild(tag);
  },
  /**
   * Resets all the workers by clearing their setInterval timer ID
   */
  reset:function(){
    this.types.forEach(function(type){
    	if(this.timers[type] !== null){
      	clearInterval(this.timers[type]);
    	}
      for(var worker in this[type]){
        if(this[type].hasOwnProperty(worker)){
          delete this[type][worker];
        }
      }
    }.bind(this));
    this._storage = {
	  	BG:{},
	  	DOM:{}
	  }
    localStorage['workers'] = JSON.stringify(this._storage);
  },
  /**
   * Updates workers object with new workers and removes old workers
   * @param {String} type - worker type (BG/DOM)
   * @param {Object} workers - workers object
   */
  updateWorkers:function(type,workers){
    // lets map new workers or update existing workers
    for(var w in workers){
      if(workers.hasOwnProperty(w)){
        if(this[type][w] !== undefined){
          this[type][w].interval = workers[w].interval;
          this[type][w].code = workers[w].code;
        } else {
          this[type][w] = workers[w];
        }
      }
    }
  },
  /**
   * Cleans up old workers. Called every time the workers manager
   * is started by the Crossrider object. Goes over worker names array in the
   * CodeParsers object to find workers that are no longer being used
   */
  _cleanUp:function(){
  	this.types.forEach(function(type){
  		var names = Crossrider.CodeParser.worker_names[type];
	  	for(var w in this[type]){
	  		if(names.indexOf(w) === -1){
	    		if(this[type].hasOwnProperty(w)){
		  			delete this[type][w];
		  		}
		  		if(this._storage[type].hasOwnProperty(w)){
		  			delete this._storage[type][w];
		  		}
	    	}
	  	}
  	}.bind(this));
  	localStorage['workers'] = JSON.stringify(this._storage);
  },
  /**
   * Gets the stored worker run time from local storage.
   * Used to ensure last run time is not lost when browser is restarted
   */
  _getStoredRunTimes:function(){
  	var storedWorkers = localStorage['workers'];
  	if(storedWorkers !== undefined){
  		this._storage = JSON.parse(storedWorkers);
  	}
  	this.types.forEach(function(type){
  		for(var w in this._storage[type]){
	    	if(this._storage[type].hasOwnProperty(w) && this[type].hasOwnProperty(w)){
		  		this[type].last_run = this._storage[type].last_run;
	    	}
	  	}
  	}.bind(this));
  },
  /**
   * Sets a worker's last run time in the local storage object.
   * Used to keep track of worker run time between browser restarts
   */
  _setLastRunTime:function(type,worker,lastRun){
		this._storage[type][worker] = {last_run:lastRun};
		localStorage['workers'] = JSON.stringify(this._storage);
  }
};

/**
 * Crossrider user script code parser
 */
Crossrider.CodeParser = {
  includes:{ //reference to any includes the user added to their script. used to ensure includes are loaded only once
    BG:{ //background workers includes
      js:[],
      css:[]
    },
    DOM:{ //dom workers & content script includes
      js:[],
      css:[]
    }
  },
  worker_names:{
  	BG:[],
  	DOM:[]
  },
  /**
   * Resets the parser object includes collection.
   * Used in debug mode or when refereshing the application code 
   */
  reset:function(){
    this.includes = {
      BG:{
        js:[],
        css:[]
      },
      DOM:{
        js:[],
        css:[]
      }
    };
    this.worker_names = {
	  	BG:[],
	  	DOM:[]
	  }
    return this;
  },
  /**
   * Parse a given code snippet, extracting @includes and @worker instructions
   * @param {String} code - code to parse
   * @param {String} context - includes context (BG / DOM). Used to parse and add includes into the correct context
   * @return {String} parsed code
   */
  parse:function(code,context){
    var parsedCode = this._parseWorkers(code,'dom_worker','DOM');
    parsedCode = this._parseWorkers(parsedCode,'bg_worker','BG');
    parsedCode = this._parseIncludes(parsedCode,(context || 'DOM'));
    return parsedCode;
  },
  /**
   * Parses given code and returns a list of workers.
   * @param {String} code - Javascript code to parse
   * @param {String} block_start - Worker block start prefix
   * @param {String} worker_type - Worker type, mapped into the Crossrider.Workers object (DOM / BG)
   * 
   * @return {String} clean code without workers
   */
  _parseWorkers:function(code,block_start,worker_type){
  	if(typeof(code) === 'string'){
	    var workers = {};
	    var cleanCode = code.replace(/\r/gi,'');
	    var reg = new RegExp("(^|\\n)@"+block_start+"\\s+\\w+\\s+\\d+\\s*\\n(\\n|.)*?@worker_end(\\n|$|\\s*?)",'gi');
	    var matches = cleanCode.match(reg);
	    for(var m in matches){
	      var res = matches[m];
	      var re1 = new RegExp("@"+block_start+"\\s+(\\w+)\\s+(\\d+)\\s*");
	      var re2 = new RegExp("@"+block_start+"\\s+\\w+\\s+\\d+\\s*\\n((.|\\n)*)\\n@worker_end(\\n|$|\\s*)");
	      var first_line = res.match(re1);
	      var name = first_line[1];
	      this.worker_names[worker_type].push(name);
	      var interval = first_line[2];
	      var worker_code = worker_type === 'bg_worker' ? res.match(re2)[1] : "(function(){\n"+res.match(re2)[1]+"\n})()";
	      workers[name] = {name: name, interval: interval, code: worker_code, last_run:0};
	      //in order to adjust the line number in case of error we need to replace *each* worker line with line_break to keep the same line numbers
	      var emptyLines = "";
	      var lines = res.split("\n");
	      var lineCount = lines.length;
	      //because of the split we can get bigger array (before the first line break and after it <-- "if" because it will not happen at the first/last line of the file)
	      // if (lines[0] == "") lineCount--; //no need for this as res itself also contain empty first line (so we will replace empty line with another empty line :) 
	      if (lines[lines.length-1] == "") lineCount--;
	      for (i=0; i<lineCount; i++) {emptyLines = emptyLines + "\n";}
	      cleanCode = cleanCode.replace(res, emptyLines);
	      if(worker_type === 'bg_worker'){
	        cleanCode = cleanCode.replace(/\s*appAPI\.callPageFunction\([^\)]+\)[\r\n;]?/gi,'');
	      }
	    }
	    
	    Crossrider.Workers.updateWorkers(worker_type,workers);
	    return cleanCode;
  	} else {
  		return '';
  	}
  },
  /**
   * Parses @include declarations in the user script.
   * Extracts include URLs and fetches the Javascript code from them
   * @param {String} code - user script to parse
   * @param {String} context - includes context (BG / DOM). Used to parse and add includes into the correct context
   * 
   * @return {String} clean code with extracted includes.
   */
  _parseIncludes:function(code,context){
    var re = /^\s*@include\s*?["'](https?:\/\/(.*?))["']\s*?(iframe)?\s*$/gim;
    var cleanCode = code.replace(/\r/gi,'');
    var includedCodeParts = [];
    var matches = cleanCode.match(re);
    var includes = [];
    for(var m in matches){
      var line = matches[m];
      var url = line.match(/(https?\:\/\/.*)['"]/)[1];
      if(this.includes[context].js.indexOf(url) < 0 && this.includes[context].css.indexOf(url) < 0){
        var type = line.match(/\.*\.(css|js)/)[1];
        if(type === 'js'){
          includes.push(url);
        }
        this.includes[context][type].push(url);
      }
      var linereg = new RegExp("^"+line.replace('?','\\?').replace('.','\\.'),"gim");
      cleanCode = cleanCode.replace(linereg,'');
    }
    for(var i = 0, l = includes.length; i < l; i++){
      var url = includes[i];
      var includedCode = Crossrider.Utils.fetchScript(url);
      includedCodeParts.push(this.parse(includedCode,context));
    }
    return includedCodeParts.join("\n") + cleanCode;
  }
}

/**
 * Utils object
 */
Crossrider.Utils = {
  /**
   * Fetches content script / css / configuration from a URL synchronously using XHR.
   * Used as an internal shortcut for Crossrider.request.
   * @param {String} url - URL to fetch data from
   * @param {String} type - request type ('xml' / 'text'). Defaults to 'text';
   */
  fetchScript:function(url,type){
  	if(Crossrider.manifest.ver !== undefined || Crossrider.debug){
	    var suffix = Crossrider.debug ? new Date().getTime() : Crossrider.manifest.ver;
	    url += (url.indexOf('?') < 0 ? '?' : '&') + 'crossriderVer='+suffix;
  	}
    return Crossrider.request({
      url:url,
      method:'get',
      async:false,
      type:type
    });
  },
  /**
   * Creates a unique string used for the extension BIC / tooblar ID
   */
  getUID : function() {
		var d = new Date();
		var timeStr = d.getTime().toString(16);
		var s = [], hexDigits = "0123456789abcdef";
		for (var i = 0; i < (32 - timeStr.length); i++) {
	    s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
		}
		
		var uuid = timeStr + s.join("");
		
		return uuid;
	},
	toInt:function(str){
		if(str === 'NA' || str === undefined){
			return 0;
		} else {
			return parseInt(str.replace(/\./g,''));
		}
	}
}