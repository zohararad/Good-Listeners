/**
 * Chrome-specific API
 */
var ChromeAPI = function(scope){
	var _scope = scope, _isBackground = typeof(Crossrider) !== 'undefined', _notifications = {};
	
	this.notification = {
		/**
	   * Shows a desktop notification
	   * @param {String} title - notification title
	   * @param {String} msg - message to show in the notification
	   * @param {String} icon - notification icon URL. If no icon is provided, defaults to icon1.
	   * @param {Object} events - notification event handlers object
	   */
		show:function(title,msg,icon,events){
			var uid = getUID();
			_notifications[uid] = events || {};
			if(_isBackground){
				Crossrider.notification(title,msg,icon,uid,_scope.tabID);
			} else {
				chrome.extension.sendRequest({action:'notification',params:[title,msg,icon,uid,_scope.tabID]}, function(){});
			}
			return uid;
		},
		/**
	   * Shows an HTML desktop notification
	   * @param {String} url - notification HTML page URL
	   * @param {Object} events - notification event handlers object
	   */
		showHTML:function(url,events){
			var uid = getUID();
			_notifications[uid] = events || {};
			if(_isBackground){
				Crossrider.htmlNotification(url,uid,_scope.tabID);
			} else {
				chrome.extension.sendRequest({action:'htmlNotification',params:[url,uid,_scope.tabID]}, function(){});
			}
			return uid;
		},
		/**
		 * Hides a notification by given UID
		 */
		hide:function(uid){
			if(_isBackground){
				Crossrider.hideNotification(uid);
			} else {
				chrome.extension.sendRequest({action:'hideNotification',params:[uid]}, function(){});
			}
		}
	}
	
	function getUID(){
		var d = new Date();
		var timeStr = d.getTime().toString(16);
		var s = [], hexDigits = "0123456789abcdef";
		for (var i = 0; i < (32 - timeStr.length); i++) {
	    s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
		}
		
		var uuid = timeStr + s.join("");
		
		return uuid;
	}
	
	/**
	 * Set chrome notifications event handling
	 */
	_scope.handleNotificationEvent = function(ev,uid){
		var n = _notifications[uid];
		if(n){
			f = n[ev];
			if(typeof(f) === 'function'){
				f();
			}
			if(ev === 'onclose'){
				delete _notifications[uid];
			}
		}
	}
	 
	/**
	 * Chrome Browser Action API
	 */
	this.browserAction = BrowserAction;
	
	if(_isBackground){
		this.omnibox = Omnibox;
		this.contextMenu = new ContextMenu();
		
		/**
		 * Adds browser action onClick event handler.
		 * @param {Function} callback - callback to call when the browser action icon is clicked.
		 */
		this.browserAction.onClick = function(callback){
			//we only register the chrome.browserAction.onClicked event once, the first time an onClick handler is passed.
			//after that we simply change the value of this._callback to point to the passed callback.
			//this ensures there are no duplicate onClick event registrations every time the background page code is parsed
			if(this._callback === undefined){
				chrome.browserAction.onClicked.addListener(function(){
					if(typeof(this._callback) === 'function'){
						this._callback();
					}
				}.bind(this));
			}
			this._callback = callback;
		}
	}
	
	return this;
}

/**
 * Chrome Omnibox API Wrapper.
 * See http://code.google.com/chrome/extensions/omnibox.html for more details
 */
var Omnibox = {
	/**
	 * Set omnibox default suggestion.
	 * @param {Object} obj - suggestion obj:
	 * 	- description {String} - The text to display in the default suggestion. The placeholder string '%s' can be included and will be replaced with the user's input.
	 */
	setDefaultSuggestion:function(obj){
		chrome.omnibox.setDefaultSuggestion(obj);
	},
	/**
	 * onInputCancelled event handler.
	 * @param {Function} callback - callback to call when omnibox input was cancelled by user
	 */
	onInputCancelled:function(callback){
		chrome.omnibox.onInputCancelled.addListener(callback);
	},
	/**
	 * onInputChanged event handler.
	 * @param {Function} callback - callback to call when omnibox input was changed by user. For example:
	 * <code>
	 * function(text, suggest) {
	     console.log('inputChanged: ' + text);
	      suggest([
	        {content: text + " one", description: "the first one"},
	        {content: text + " number two", description: "the second entry"}
	      ]);
	    });
	 * </code>
	 */
	onInputChanged:function(callback){
		chrome.omnibox.onInputChanged.addListener(callback);
	},
	/**
	 * onInputEntered event handler.
	 * @param {Function} callback - callback to call when user accepted what was typed in the omnibox.
	 */
	onInputEntered:function(callback){
		chrome.omnibox.onInputEntered.addListener(callback);
	},
	/**
	 * onInputStarted event handler.
	 * @param {Function} callback - callback to call when user typed the extension's keyword in the omnibox.
	 */
	onInputStarted:function(callback){
		chrome.omnibox.onInputStarted.addListener(callback);
	}
}

var ContextMenu = function(){
	var _menus = {}, _isBackground = typeof(Crossrider) !== 'undefined';;
	
	/**
	 * Add context menu entry.
	 * @param {String} name - menu entry name
	 * @param {String} title - menu entry title
	 * @param {Function} onClick - entry on click handler
	 */
	this.add = function(name,title,onClick){
		if(!_menus[name]){
			_menus[name] = chrome.contextMenus.create({
				title:title,
				onclick:onClick
			});
		}
	}
	
	/**
	 * Removes a previously added context menu entry.
	 * @param {String} name - name of the menu entry to remove
	 */
	this.remove = function(name){
		if(_menus[name]){
			chrome.contextMenus.remove(_menus[name]);
			delete _menus[name];
		}
	}
	
	/**
	 * Removes all context menu entries added by the application
	 */
	this.removeAll = function(){
		chrome.contextMenus.removeAll();
		_menus = {};
	}
	
	/**
	 * Updates a context menu entry title.
	 * @param {String} name - name of the entry to update
	 * @param {String} title - new title for the entry
	 */
	this.updateTitle = function(name,title){
		if(_menus[name]){
			chrome.contextMenus.update(_menus[name],{title:title});
		}
	}
	
	/**
	 * Updates an entry's on click handler.
	 * @param {String} name - name of the entry to update
	 * @param {Function} onClick - new on click handler
	 */
	this.updateOnClick = function(name,onClick){
		if(_menus[name]){
			chrome.contextMenus.update(_menus[name],{onclick:onClick});
		}
	}
	
	/**
	 * Handles onClick events sent from BG page handler when a menu entry was clicked.
	 * Calls the entry's onClick callback.
	 * @param {String} name - name of the menu entry that was clicked
	 */
	this.handleContextMenuClick = function(name){
		if(_menus[name]){
			_menus[name]['callback']();
		}
	}
}

/**
 * Browser Action handling
 */
var BrowserAction = {
	/**
	 * Sets browser action badge text
	 * @param {String} text - badge text to set
	 */
	setBadgeText:function(text){
		if(typeof(Crossrider) !== 'undefined'){
			Crossrider.setBadgeText(text);
		} else {
			chrome.extension.sendRequest({action:'setBadgeText',params:[text]}, function(){});
		}
	},
	/**
	 * Sets browser action badge BG color
	 * @param {Array} color - background color array (RGBA). For example: [255,0,0,1]
	 */
	setBadgeBackgroundColor:function(color){
		if(typeof(Crossrider) !== 'undefined'){
			Crossrider.setBadgeBackgroundColor(color);
		} else {
			chrome.extension.sendRequest({action:'setBadgeBackgroundColor',params:[color]}, function(){});
		}
	},
	/**
	 * Sets browesr action icon. User can choose from a set list of icons provided by Crossrider
	 * @param {String} icon - icon to set from icon list. For example icon1.png
	 */
	setIcon:function(icon){
		if(typeof(Crossrider) !== 'undefined'){
			Crossrider.setIcon(icon);
		} else {
			chrome.extension.sendRequest({action:'setIcon',params:[icon]}, function(){});
		}
	},
	/**
	 * Sets the browser action title (tooltip)
	 * @param {String} title - title to set
	 */
	setTitle:function(title){
		if(typeof(Crossrider) !== 'undefined'){
			Crossrider.setTitle(title);
		} else {
			chrome.extension.sendRequest({action:'setTitle',params:[title]}, function(){});
		}
	},
	/**
	 * Enables browser action popup
	 */
	enablePopup:function(){
		if(typeof(Crossrider) !== 'undefined'){
			Crossrider.enablePopup();
		} else {
			chrome.extension.sendRequest({action:'enablePopup'}, function(){});
		}
	},
	/**
	 * Disables browser action popup
	 */
	disablePopup:function(){
		if(typeof(Crossrider) !== 'undefined'){
			Crossrider.disablePopup();
		} else {
			chrome.extension.sendRequest({action:'disablePopup'}, function(){});
		}
	}
}