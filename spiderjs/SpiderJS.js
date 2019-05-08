/**
  * @SpiderJs v0.1.1
  * @Date: 2019-04-18
  * @auther: Cody
  * @Email: 1170096634@qq.com
  * @github: ...
  */
 (function(global, factory){
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.SpiderJs = factory());
}(this,(function(){
    'use strict';
    const _global = window;

    /**
     * 保存数据队列
     * @param {string} name 
     * @param {*} data 
     */
    function setStorg(name,data){
        if(!name || !data) return;
        try{
            const result = JSON.stringify(data);
            _global.localStorage.setItem(name,result);
        }catch(err){}
    }

    /**
     * 获取数据
     * @param {string} name 
     */
    function getStorg(name){
        if(!name) return;
        try{
            const result = _global.localStorage.getItem(name);
            return result ? JSON.parse(result) : null;
        }catch(err){}
    }

    /**
     * 合并客户端配置参数
     * @param {object} options 
     */
	function optionParam(options){
		return Object.assign({
			// 用户id
			userid: 1,
			// 上报接口
            domain: 'http://localhost:8080/api',
            // wp,host,agency,tk,mt
            platform: 'wp',
			// 上报页面性能数据
			isPage: true,
			// 上报页面资源数据
			isResource: true,
			// 上报错误信息
			isError: true,
			// 延迟上报时间
			delay: 1000,
			// 离线日志过期时间
			logsTime: 5,
			// 上报时间间隔
			delayTime: 12,
			// 错误操作页面截图
            printscreen: false,
            // 本地缓存
            isStorg: true
		}, options);
    }

	var SpiderJs = function SpiderJs(options){
		if ( options === void 0 || typeof options !== 'object') return console.warn('参数传入错误，请查看文档!');
		// 全局配置参数
		this.config = {
			// 页面性能列表
			performance: {},
			// 错误列表
			errorList: [],
			// 资源统计
			resourceList: [],
			// 配置参数
			default: optionParam(options)
        };
		this.init(this.config);
    }

    const _spiderJs = SpiderJs.prototype;

	_spiderJs.init = function(options){
		try{
            if(options.default.isError) this.gatherError(options);
            if(options.default.isPage) this.perforPage(options);
            if(options.default.isResource) this.perforResource(options);
        }catch(err){this.logger(err)}
        setTimeout(()=> {
            // 这里是提交错误到后台的地方
            console.log(options)
        }, options.default.delay);
	}

	/**
	 * 统计页面性能
	 * @param { object } options 
	 */
	_spiderJs.perforPage = function(options,fn) {
		const perf = (_global.performance ? _global.performance : console.warn('浏览器不兼容！'));
		const timing = perf.timing;
        const start = timing.navigationStart;
        const width = document.documentElement.clientWidth || document.body.clientWidth;
        const height = document.documentElement.clientHeight || document.body.clientHeight;
		const points = {
			domainLookupEnd: timing.domainLookupStart,
			connectEnd: timing.connectStart,
			responseStart: start,
			domContentLoadedEventEnd: start,
			loadEventEnd: start,
			fetchStart: start,
			redirectEnd: timing.redirectStart,
			unloadEventEnd: timing.unloadEventStart,
			responseEnd: timing.requestStart,
			domComplete: timing.domInteractive
		};
		const json = {};
		for (const key in points) {
			json[key] = timing[key] - points[key] || 0;
		}
		this.config.performance = Object.assign(json,{
            screenwidth: width,
            screenheight: height,
            browser: _global.navigator.userAgent
        });
	}

	/**
	 * 统计静态资源性能
	 * @param { object } options 
	 */
	_spiderJs.perforResource = function(options){
		const perf = _global.performance;
		if (!perf) return console.warn('浏览器不兼容！');
		//perf.getEntriesByType('resource');
		// 获取全部类型的资源
		const resource = perf.getEntries();
		if(!resource) return;
		let resourceList = [];
		resource.map((item)=> {
			const json = {
				// 资源路径
				url: item.name || null,
				// 资源类型
				initiator: item.initiatorType || null,
				entry: item.entryType || null,
				// 资源大小
				size: item.decodedBodySize || 0,
				// http版本
				nextHopProtocol: item.nextHopProtocol || null,
				// 加载时间或responseEnd - startTime
				duration: item.duration.toFixed(5) || 0,
				// DNS查询时间
				DNS: item.domainLookupEnd - item.domainLookupStart || 0,
				// TCP三次握手时间
				TCP: item.connectEnd - item.connectStart || 0,
				// request请求时间
				request: item.responseEnd - item.responseStart || 0
			};
			resourceList.unshift(json);
		});
		this.config.resourceList = resourceList;
	}

	/**
	 * try{}catch 手动上报错误信息
	 * @param {*} e error
	 */
	_spiderJs.logger = function(e){
		const message = e.message || '';
		const stack = e.stack || '';
		const stk = this.utils(stack);
		this.mapError('tryCatch',message,stack,stk.line,stk.col,stk.url);
	}

	/**
	 * 统计错误信息
	 * @param { object } options
	 */
	_spiderJs.gatherError = function(options){
		_global.addEventListener('error', (e)=> {
			const message = e.message || e.target.outerHTML;
			const url = e.filename || e.target.src;
			const stack = e.target.outerHTML || '跨域错误，暂时不处理！';
			if(e.error && e.error.stack){
				const stk = e.error.stack;
				const obj = this.utils(stk);
                this.mapError(e.type,message,stk,obj.line,obj.col,url);
                return;
            }
            this.mapError(e.type,message,stack,0,0,url);
		}, true);
		_global.onerror = (msg,url,line,col,error)=> {
			if(msg == 'Script error.') return;
			setTimeout(()=> {
                col = col || (_global.event && _global.event.errorCharacter) || 0;
                if(options.default.printscreen){
                    this.printscreen('onerror',msg,error,line,col,url);
                    return;
                }
                this.mapError('onerror',msg,error,line,col,url);
            }, 0);
			return true;
		};
		_global.addEventListener('unhandledrejection', (e)=> {
			const error = e && e.reason;
			const message = error.message || '';
			const stack = error.stack || '';
			if(!error || typeof error == 'string'){
				this.mapError('Promise',error,error,0,0,null);
				return;
			}
			const obj = this.utils(stack);
			this.mapError('Promise',message,stack,obj.line,obj.col,obj.url);
		});
	}

	_spiderJs.mapError = function(type,msg,stack,line,col,url,screen){
		this.config.errorList.push({
			type: type,
			message: msg,
			stack: stack,
			line: line,
			col: col,
			url: url,
			time: new Date().getTime(),
            path: _global.location.href,
            screen: screen
		});
	}

	_spiderJs.utils = function(e){
		const matchUrl = e.match(/(file|http|https).*?(.html|.js)/gi);
		const matchLine = e.match(/(.html:|.js:).*?(:)\d{0,15}/gi);
		const res = matchLine[0].split(':');
		return {
			url: matchUrl[0],
			line: res[1],
			col: res[2]
		}
    },
    
    _spiderJs.printscreen = function(type,msg,error,line,col,url){
        try{
            printscreen(document.querySelector('html')).then((canvas)=> {
                this.mapError('onerror',msg,error,line,col,url,canvas.toDataURL());
            });
        }catch(err){
            this.logger(err);
            this.mapError('onerror',msg,error,line,col,url);
        }
    }

	SpiderJs.version = '0.1.1';
	return SpiderJs;
})))