	document.getElementById("page-url").src = setting.qrcodeApi + urlEncode(window.location.href+"pay");
	document.getElementById("code-all").style.display = "block";
	/*****************************************
	* url编码函数
	* 输入参数：待编码的字符串
	* 输出参数：编码好的
	****************************************/
		function urlEncode(String) {
			return encodeURIComponent(String).replace(/'/g,"%27").replace(/"/g,"%22");	
	}
