var Message = function(){
	var _tabID = null, listener = null;
	
	/**
	 * Sends a message to background page, active tab or all tabs
	 * @param {String} type - message type (all / active / background)
	 * @param {Object} msg - message to send
	 * @param {Number} tabID - optional tab ID that identifies the sending tab
	 */
	var message = function(type,msg,tabID){
		if(typeof(Crossrider) === 'undefined'){
			chrome.extension.sendRequest({action:'message',params:[type,msg,tabID]}, function(){});
		} else {
			Crossrider.message(type,msg);
		}
	}
	
	/**
	 * Sets the id of a content script's embedding tab to a local variable.
	 * This value is then sent up the call chain to help identify a calling tab when sending messages between tabs and background page
	 * @param {Number} tabID - content script's tab ID
	 */
	this.setTabId = function(tabID){
		_tabID = tabID;	
	}
	
	/**
	 * Sends a message to active tab.
	 * @param {Object} message - message to send
	 */
	this.toActiveTab = function(msg){
		message('active',msg,_tabID);
	}
	
	/**
	 * Sends a message to all tab.
	 * @param {Object} message - message to send
	 */
	this.toAllTabs = function(msg){
		message('all',msg,_tabID);
	}
	
	/**
	 * Sends a message to background page.
	 * @param {Object} message - message to send
	 */
	this.toBackground = function(msg){
		message('background',msg,_tabID);
	}
	
	/**
	 * Calls the registered callback, passing it the message received from the caller.
	 * @param {Object} message - message to send
	 */
	this.call = function(msg){
		if(typeof(listener) === 'function'){
			listener(msg);
		}
	}
	/**
	 * Adds message listener to content script scope
	 * @param {Function} callback - callback to execute when a message is received
	 */
	this.addListener = function(callback){
		listener = callback;
	}
	
	/**
	 * Removes message listener from content script scope
	 */
	this.removeListener = function(){
		listener = null;
	}
		
	return this;
}
