	if(navigator.userAgent.match(/Alipay/i)) {
	/* 支付宝 */ 
			window.location.href = setting.aliUrl; 
	} else if(navigator.userAgent.match(/MicroMessenger\//i)) {
	/* 微信 */ 
			document.getElementById("wechat-url").src = setting.qrcodeApi + urlEncode(setting.wechatUrl);
			document.getElementById("code-wechat").style.display = "block";
	} else if(navigator.userAgent.match(/QQ\//i)) {
	/* QQ */ 
			document.getElementById("qq-url").src = setting.qrcodeApi + urlEncode(setting.qqUrl);
			document.getElementById("code-qq").style.display = "block";
	} else {
	/* 其它，显示“万能码” */ 
			document.getElementById("page-url").src = setting.qrcodeApi + urlEncode(window.location.href);
			document.getElementById("code-all").style.display = "block";
	}
	
	/*****************************************
	* url编码函数
	* 输入参数：待编码的字符串
	* 输出参数：编码好的
	****************************************/
		function urlEncode(String) {
			return encodeURIComponent(String).replace(/'/g,"%27").replace(/"/g,"%22");	
	}