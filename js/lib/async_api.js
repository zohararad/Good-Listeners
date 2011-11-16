/**
 * Async API calls handler.
 * Handles requests from page to call appAPI functions
 */
var AsyncAPI = {
	_dom:{},
	_responseQueue:[],
  _responseQueueBusy:false,
	/**
	 * Initialize the Async API handler
	 * @param {Object} api - reference to appAPI object
	 */
	init:function(api){
		this._api = api;
		window.addEventListener('message',this._handlePageFunction.bind(this),false);
		this._dom.body = document.getElementsByTagName('body')[0];
		return this;
	},
	/**
	 * Handles calls from page done with window.postMessage
	 * @param {Event} e - postMessage event
	 */
	_handlePageFunction:function(e){
		var origin = e.origin, data = e.data;
		if((this._api.manifest['domain'] !== undefined && origin.indexOf(this._api.manifest['domain']) < 0) || data['caller'] !== 'asyncAPI' || data.appID !== this._api.appID){ return; }
		var parts = data.action.split('.'), f, context;
		if(parts.length === 1){
			f = this._api[parts[0]];
			context = this._api;
		} else if (parts.length === 2) {
			f = this._api[parts[0]][parts[1]];
			context = this._api[parts[0]];
		}
		if(typeof(f) === 'function'){
			if(parts[0] == 'fbAPI' || (data.action === 'push.subscribe')){
				var callback = function(){
					var args = [data.action];
					for(var i = 0; i < arguments.length; i++){
						args.push(arguments[i]);
					}
					this.sendResponse(args,data.iframe, data.ts);
				}.bind(this);
				data.params.push(callback);
				if(data.action === 'push.subscribe'){
					data.params.push(true);
				}
				f.apply(context,data.params);
			} else if (data.action === 'cookie.get' || data.action === 'db.setFromRemote' || data.action === 'request.get' || data.action === 'request.post'){
				var success = function(response){
					var args = [data.action,true,response];
					this.sendResponse(args,data.iframe, data.ts);
				}.bind(this);
				data.params.push(success);
				var failure = function(status){
					var args = [data.action,false,status];
					this.sendResponse(args,data.iframe, data.ts);
				}.bind(this);
				data.params.push(failure);
				f.apply(context,data.params);
			} else {
				if(data.action === 'push.unsubscribe'){
					data.params.push(true);
				}
				var response = f.apply(context,data.params);
				this.sendResponse([data.action,response],data.iframe, data.ts);
			}
		}
	},
	/**
	 * Sends a response from async API to calling page
	 * @param {Array} args - array of response arguments
	 * @param {Boolean} iframe - if true, will try to call the async callback on this._iframe
	 * @param {Number} ts - unique timestamp that identifies the action
	 */
	sendResponse:function(args,iframe, ts){
		//add this request to our queue (if it's real request)
    if (args !== "QUEUE") {
      this._responseQueue.push({args:args, iframe:iframe, ts:ts});
      if (this._responseQueueBusy){
        return; //we are waiting for another request.
      }
    }
    
    if (this._responseQueue.length > 0) {
      //flag ourselves as "busy"
      this._responseQueueBusy = true;
      
      //take the next callback to execute
      var nextCallback = this._responseQueue.shift();

      var action = nextCallback.args[0].replace(/\./g,'_');
      var textarea = this._createResponseElement(action,nextCallback.ts);
      textarea.value = JSON.stringify({args:nextCallback.args});
      if(nextCallback.iframe === true){
        this._api.dom.callPageFunction('callCrossriderAsyncApi'+this._api.appID,action,nextCallback.ts);
      } else {
        this._api.dom.callPageFunction('crossrider.AsyncAPI.onPageResponse',action,nextCallback.ts);
      }
      setTimeout(this.sendResponse.bind(this),10,'QUEUE');
    } else {
      this._responseQueueBusy = false;
    }
	},
	/**
	 * Sets async target to an iframe instead of current window.
	 * @param {String} id - ID of the iframe to use as call target for async responses
	 */
	setTargetIframe:function(id){
		var script = document.createElement('script');
		script.type = 'text/javascript';
		script.innerHTML = 'function callCrossriderAsyncApi'+this._api.appID+'(action,ts){var el = document.getElementById("crossrider-response-element-'+this._api.appID+'"+action+ts); var response = JSON.parse(el.value); el.parentNode.removeChild(el); document.getElementById("'+id+'").contentWindow.postMessage({caller:"asyncAPIResponse", appID:'+this._api.appID+', args:response.args, ts:ts},"*");}';
		this._dom.body.appendChild(script);
	},
	/**
	 * Adds a DOM element to the page that serves as the container for async API responses
	 * @param {String} action - response action name
	 * @param {String} ts - unique timestamp to allow several response elements per action
	 */
	_createResponseElement:function(action,ts){
		var textarea = document.createElement('textarea');
		textarea.id = 'crossrider-response-element-'+this._api.appID+action+ts;
		textarea.style.display = 'none';
		this._dom.body.appendChild(textarea);
		return textarea;
	}
}