var FacebookAPI = function(scope){
	var _self = scope, callbacks = {};
	
	this.bridge = FBBridge.init(scope.manifest.remotefbapiurl,scope.appID,true);
	
	function fbLoginPopupWindow() {
		var regexp = /^(https\:\/\/www|ssl\.facebook\.com\/login\.php|https\:\/\/www\.facebook\.com\/connect\/uiserver\.php|http\:\/\/static\.ak\.fbcdn\.net\/connect\/xd_proxy\.php|https\:\/\/www\.facebook\.com\/login\.php).*/;
		return window.location.href.match(regexp);
	}
	
	this.callback = function(action,response){
		if(typeof(callbacks[action]) === 'function'){
			var c = callbacks[action];
			var r = typeof(response['push']) === 'function' ? response : [response];
			for(var i = 0, l = r.length; i < l; i++){
				var p = r[i];
				if(typeof(p) === 'string' && p.indexOf('{') > -1){
					r[i] = JSON.parse(p);
				}
			}
			c.apply(c,r);
			delete callbacks[action];
		}
	}
	
	this.invite = function(share_options, callback){
    if(fbLoginPopupWindow()) { return; }
    var action = 'invite';
		callbacks[action] = callback;
    this.bridge.exec(_self.tabID, action, share_options);
  }
  
  this.connect = function(callback){
    if(fbLoginPopupWindow()) { return; }
		var action = 'connect';
		callbacks[action] = callback;
		chrome.extension.sendRequest({action:'fb_bridge',params:[_self.tabID,action]}, function(){});
  }
  
  this.isConnected = function(callback){
    if(fbLoginPopupWindow()) { return; }
		var action = 'is_connected';
		callbacks[action] = callback;
		chrome.extension.sendRequest({action:'fb_bridge',params:[_self.tabID,action]}, function(){});
  }
  
  this.postToWall = function(share_options, callback){
    if(fbLoginPopupWindow()){ return; }
    var action = 'post_to_wall';
    callbacks[action] = callback;
    chrome.extension.sendRequest({action:'fb_bridge',params:[_self.tabID,action,share_options]}, function(){});
  }
  
  this.getFriends = function(callback){
    if(fbLoginPopupWindow()){ return; }
    var action = 'get_friends';
    callbacks[action] = callback;
    chrome.extension.sendRequest({action:'fb_bridge',params:[_self.tabID,action]}, function(){});
  }
  
  this.getInfo = function(id, callback){
    if(fbLoginPopupWindow()){ return; }
    var action = 'get_info';
    callbacks[action] = callback;
    chrome.extension.sendRequest({action:'fb_bridge',params:[_self.tabID,action,{id:escape(id)}]}, function(){});
  }
  
  this.getMyInfo = function(callback){
    if(fbLoginPopupWindow()){ return; }
    this.getInfo('me',callback);
  }
  
  this.updateStatus = function(message, callback){
    if(fbLoginPopupWindow()){ return; }
    var action = 'update_status';
    callbacks[action] = callback;
    chrome.extension.sendRequest({action:'fb_bridge',params:[_self.tabID,action,{message:escape(message)}]}, function(){});
  }
  
  this.logout = function(callback){
    if(fbLoginPopupWindow()){ return; }
    var action = 'logout';
    callbacks[action] = callback;
    chrome.extension.sendRequest({action:'fb_bridge',params:[_self.tabID,action]}, function(){});
  }
  
  this.getGroups = function(callback){
    if(fbLoginPopupWindow()){ return; }
    var action = 'get_groups';
    callbacks[action] = callback;
    chrome.extension.sendRequest({action:'fb_bridge',params:[_self.tabID,action]}, function(){});
  }
  
  this.getPages = function(callback){
    if(fbLoginPopupWindow()){ return; }
    var action = 'get_pages';
    callbacks[action] = callback;
    chrome.extension.sendRequest({action:'fb_bridge',params:[_self.tabID,action]}, function(){});
  }
  
  this.postToGroups = function(groupsArray, share_options, callback){
    if(fbLoginPopupWindow()){ return; }
    var action = 'post_to_groups';
    callbacks[action] = callback;
    share_options.ids = groupsArray.join(",");
    chrome.extension.sendRequest({action:'fb_bridge',params:[_self.tabID,action,share_options]}, function(){});
  }
  
  this.postToGroup = function(groupId, share_options, callback){
    if(fbLoginPopupWindow()){ return; }
    this.postToGroups([groupId], share_options, callback);
  }
  
  this.postToPages = function(pagesArray, share_options, callback){
    if(fbLoginPopupWindow()){ return; }
    var action = 'post_to_pages';
    callbacks[action] = callback;
    share_options.ids = pagesArray.join(",");
    chrome.extension.sendRequest({action:'fb_bridge',params:[_self.tabID,action,share_options]}, function(){});
  }
  
  this.postToPage = function(pageId, share_options, callback){
    if(fbLoginPopupWindow()){ return; }
    this.postToPages([pageId], share_options, callback);
  }
  
  this.postToFriends = function(friendsArray, share_options, callback){
    if(fbLoginPopupWindow()){ return; }
    var action = 'post_to_friends';
    callbacks[action] = callback;
    share_options.ids = friendsArray.join(",");
    chrome.extension.sendRequest({action:'fb_bridge',params:[_self.tabID,action,share_options]}, function(){});
  }
  
  this.postToFriend = function(friendId, share_options, callback){
    if(fbLoginPopupWindow()){ return; }
    this.postToFriends([friendId], share_options, callback);
  }
  
  this.fbShare = function(url, callback){
    if(fbLoginPopupWindow()){ return; }
    var action = 'ui_share';
		callbacks[action] = callback;
    this.bridge.exec(_self.tabID, action, escape(url));
  }
  
  this.fbPublish = function(share_options, callback){
    if(fbLoginPopupWindow()){ return; }
    var action = 'ui_publish';
		callbacks[action] = callback;
    this.bridge.exec(_self.tabID, action, share_options);
  }
}