/**
 * Facebook communication bridge to crossrider.
 * Handles communication between extension and facebook API via crossrider
 */
var FBBridge = {
	_params:{},
	_dom:{},
	_connected:false,
	transparent:false,
	/**
	 * Initialize the bridge
	 * @param {String} fbBaseUrl - facebook server-side communication URL (either via crossrider or user-defined via manifest)
	 * @param {String} appID - app ID
	 * @param {Boolean} transparent - is this a transparent or invisible iframe
	 */
	init:function(fbBaseUrl, appID, transparent){
		this._params.useCrossriderSupport = true;
		this._params.appID = appID;
		this.transparent = transparent;
  	this._params.fb_baseurl = 'http://app' + this._params.appID + '.crossrider.com/fb';
  	if (fbBaseUrl && fbBaseUrl.indexOf('http') > -1) {  
      this._params.useCrossriderSupport = false; //we should use the developer app url
      this._params.fb_baseurl = fbBaseUrl + "?appid=" + this._params.appID + "&aid=" + this._params.appID;
    }
    this._dom.container = document.createElement('div');
    this._dom.container.setAttribute('style','position:absolute;top:-1000px');
    document.body.appendChild(this._dom.container);
    window.addEventListener('message',this.handleFacebookCallback.bind(this),false);
    return this;
	},
	/**
	 * Handles responses from the server-side facebook API via window.postMessage
	 * @param {MessageEvent} e - postMessage event with response data from server
	 */
	handleFacebookCallback:function(e){
		var origin = e.origin, data = e.data;
		var iframeID = this.getActionID(data.action,data.tabId);
		var _that = this;
    if(this._params.fb_baseurl.indexOf(origin) !== 0){ return; }
		if(this.transparent){
			this._dom.container.innerHTML = '';
			if(data.action === 'close_invite_window'){
				data.action = 'invite';
			}
			appAPI.fbAPI.callback(data.action,data.response);
			_that.removeIframe(iframeID);
		} else {
	    if(data.tabId === null){
		    chrome.tabs.getSelected(null, function(tab) {
				if (!tab) {
					_that.removeIframe(iframeID);
					return;
				}
		      chrome.tabs.sendRequest(tab.id, {action: 'fb_respond', params:[data.action,data.response]}, function() {
					_that.removeIframe(iframeID);
				});
		    });
	    } else {
		    chrome.tabs.get(parseInt(data.tabId),function(tab){
				// it might take some time to return the response from crossrider and tab might be closed
				if (!tab) {
					_that.removeIframe(iframeID);
					return;
				}
		    	chrome.tabs.sendRequest(tab.id, {action: 'fb_respond', params:[data.action,data.response]}, function() {
					_that.removeIframe(iframeID);
				});
		    });
	    }
		}
	},
	/**
	 * Generates a unique URL per api action for the api request iframe
	 * @param {String} action - api action to perform
	 * @param {String} param - action params
	 * @param {tabID} - api action tab id (to perserve context of actions in tabs)
	 * @returns {String} api action request URL
	 */
	generateUrl:function(action, params, tabID) {
    if (this._params.useCrossriderSupport) {
      return this._params.fb_baseurl + "/" + action + "?appid=" + this._params.appID + '&tid=' + tabID + params;  
    } else {
      return this._params.fb_baseurl + "&api=" + action + '&tid=' + tabID + params;
    }
  },
  /**
   * Converts a JSON object into a query string
   * @param {Object} hash - query string JSON object
   * @returns {String} query string
   */
  hash_to_params:function(hash) {
    var params = ['&'];
    for (var k in hash) {
      params.push(k + "=" + escape(hash[k]));
    };
    return params.join('&');
  },
  /**
   * Executes a call to the server-side facebook api
   * @param {String} tabId - calling tab ID
   * @param {String} action - api action to perform
   * @param {Object} options - action optional parameters
   */
  exec:function(tabId,action,options){
    var id = this.getActionID(action,tabId);
    var params = options ? this.hash_to_params(options) : '';
    var url = this.generateUrl(action, params, tabId);
    this.removeIframe(id);
    
    var iframe = document.createElement('iframe');
    iframe.setAttribute("id", id);
    iframe.setAttribute('src',url);
    iframe.setAttribute('allowtransparency', 'true');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('width', '10');
    iframe.setAttribute('height', '10');
    this._dom.container.appendChild(iframe);
    if(this.transparent){
    	iframe.setAttribute('style', 'position:fixed !important; top:0 !important;left:0 !important; border:0 !important; width:99% !important; height:100% !important; z-index:99999 !important;visibility:hidden');
    	jQuery(iframe).load(function(e){
    		iframe.style.visibility = 'visible';
    	});
    }
  },
  /**
   * Removes api request iframes from the DOM
   * @param {String} id - iframe ID
   */
  removeIframe:function(id){
    var iframe = document.getElementById(id);
    if(iframe){
      this._dom.container.removeChild(iframe);
    }
  },
  /**
   * Generates a unique ID for an api action request.
   * This ID is used to identify the iframe that will perform the api request to the server
   * @returns {String} unique ID based in api action and current tab ID
   */
  getActionID:function(action,tabID){
    return ['crossrider',action,'iframe',this._params.appID,tabID].join('-');
  }
}