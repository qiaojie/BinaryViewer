const vscode = acquireVsCodeApi();

var DataType = {
	ASCII: 1,
	UTF8: 2,
	UTF16: 3,
	int8: 4,
	int16: 5,
	int32: 6,
	int64: 7,
	float32: 8,
	float64: 9
}
function padding(s, n) {
	if (n <= s.length)
		return s;
	return "0".repeat(n - s.length) + s;
}
function spacepadding(s, n, last) {
	s = s.toString();
	if (n <= s.length)
		return s;
	s = last ? (s + " ".repeat(n - s.length)) : (" ".repeat(n - s.length) + s);
	if (last)
		s = s[0] == "-" ? s + " " : " " + s;	
	return s;
}
function addRow(html, idx) {
	var tr = $("#table tr:last");
	if (tr.length == 0) {
		return;
	}
	var t = tr.after(html)[0];
	t.cells[1].cellIdx = [idx, 0];
	t.cells[2].cellIdx = [idx, 1];
}
function fillRow(row, pos, s0, s1, type, data) {
	var tr = $(`#table tr`);
	var cells = tr[row + 1].cells;
	cells[0].innerText = pos;
	cells[1].innerText = s0;
	cells[2].innerText = s1;
	fillView(cells[4], type, data);
}

function fillView(cell, type, data){
	if (type == DataType.ASCII || type == DataType.UTF8 || type == DataType.UTF16)
		cell.innerText = data;
	else {
		if (type == DataType.int8)
			cell.innerHTML = "<pre class='smallFont'>" + data + "</pre>";
		else
			cell.innerHTML = "<pre>" + data + "</pre>";
	}
}

function resizeRow(count) {
	//console.log("resizeRow", count);
	var len = $("#table tr:not(:first)").length;
	for (var i = len; i < count; i++)
		addRow("<tr><td></td><td></td><td></td><td></td><td></td></tr>", i - 1);
}

var rowHeight = $("#table tr")[1].clientHeight;
$("#table tr:not(:first)").remove();
function getRowCount() {
	var total = $(".frame")[0].clientHeight;
	//console.log("getRowCount", total, rowHeight);
	return ((total / rowHeight) + 1) | 0;
}

function getViewData(start, end, type) {
	var unsigned = $("#unsigned").is(':checked');
	var littleEndian = !$("#bigendian").is(':checked');
	var s = "";
	var dataView = new DataView(bytes.buffer);
	var i = start;
	switch (type) {
		case DataType.ASCII:
			for (i = start; i < end; i++)
				s += bytes[i] >= 20 && bytes[i] <= 127 ? String.fromCharCode(bytes[i]) : ".";
			break;
		case DataType.UTF16:
			for (i = start; i < end; i += 2){
				var u = dataView.getUint16(i, littleEndian);
				if (u < 32)
					s += ".";
				else if (u < 0xD800 || u > 0xDFFF)
					s += String.fromCharCode(u);
				else{
					s += String.fromCharCode(u, dataView.getUint16(i + 2, littleEndian));
					i += 2;
				}
			}
			break;
		case DataType.UTF8:
			for (i = start; i < end; ) {
				let c = bytes[i++];
				if(c < 128)
					s += c >= 32 ? String.fromCharCode(c) : ".";
				else if ((c & 0xc0) != 0xc0)
					s += ".";
				else {
					let u = 0;
					let len;
					if ((c & 224) == 192) { //11000000
						len = 1;
						u = c & 31;
					}
					else if ((c & 240) == 224) { //11100000
						len = 2;
						u = c & 15;
					}
					else if ((c & 248) == 240) { // 11110000
						len = 3;
						u = c & 7;
					}
					else if ((c & 252) == 248) { // 11111000
						len = 4;
						u = c & 3;
					}
					for(let j = 0; j < len; j++){
						if ((bytes[i + j] & 192) != 128){
							s += '.';
							u = 0;
							break;
						}
						u = (u << 6) | bytes[i + j] & 63;
					}
					if(u > 0){
						i += len;
						if(u < 65536)
							s += String.fromCharCode(u);
						else{
							var ch = u - 65536;
							s += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
						}
					}
				}
			}
			break;
		case DataType.int8:
			for (i = start; i < end; i++)
				s += spacepadding(unsigned ? dataView.getUint8(i) : dataView.getInt8(i), 5);
			break;
		case DataType.int16:
			for (i = start; i < end - 1; i += 2)
				s += spacepadding(unsigned ? dataView.getUint16(i, littleEndian) : dataView.getInt16(i, littleEndian), 7);
			break;
		case DataType.int32:
			for (i = start; i < end - 3; i += 4)
				s += spacepadding((unsigned ? dataView.getUint32(i, littleEndian) : dataView.getInt32(i, littleEndian)), 12);
			break;
		case DataType.int64:
			for (i = start; i < end - 7; i += 8)
				s += spacepadding(readBigInt(dataView, i, littleEndian, unsigned), 22);
			break;
		case DataType.float32:
			for (i = start; i < end - 3; i += 4)
				s += spacepadding((unsigned ? dataView.getFloat32(i, littleEndian) : dataView.getFloat32(i, littleEndian)).toPrecision(7), 15, true);
			break;
		case DataType.float64:
			for (i = start; i < end - 7; i += 8)
				s += spacepadding((unsigned ? dataView.getFloat64(i, littleEndian) : dataView.getFloat64(i, littleEndian)), 25, true);
			break;
	}
	return s;
}

function changeDataView(){
	var len = bytes.length;
	var view = parseInt($("#view").val());
	var tr = $("#table tr");
	var row = 1;
	for (var i = 0; i < len; i += 16) {
		var cell = tr[row].cells[4];
		fillView(cell, view, getViewData(i, Math.min(i + 16, len), view));
		row++;
	}
}
$("#unsigned").on("change", changeDataView);
$("#bigendian").on("change", changeDataView);
$("#view").on("change", changeDataView);

var rowCount = getRowCount();
var position = 0;
var bytes;

function fillData(inputData) {
	var start = position;
	bytes = inputData;
	var len = bytes.length;
	//console.log("fillData", len);
	var row = 0;
	var type = parseInt($("#view").val());
	for (var i = 0; i < len; i += 16) {
		var pos = padding(start.toString(16), 8);
		var p0 = Math.min(len, i + 8) - i;
		var p1 = Math.min(len, i + 16) - i;
		var s0 = "";
		var s1 = "";
		for (var j = 0; j < p0; j++)
			s0 += `${padding(bytes[i + j].toString(16), 2)} `;
		for (j = p0; j < p1; j++)
			s1 += `${padding(bytes[i + j].toString(16), 2)} `;
		fillRow(row++, pos, s0, s1, type, getViewData(i, i + p1, type));
		start += 16;
	}
	var tr = $(`#table tr`);
	for (i = row + 1; i < tr.length; i++) {
		tr[i].cells[0].innerText = tr[i].cells[1].innerText = tr[i].cells[2].innerText = "";
		tr[i].cells[4].innerHTML = "";
	}
}

document.body.onresize = function(){
	var count = getRowCount();
	if (count > rowCount) {
		rowCount = count;
		resizeRow(rowCount);
		getData(count);
	}
	rowCount = count;
}

function getOffset(){
	var v = $("#offset").val();
	if (/^-?0x[0-9A-Fa-f]+$/.test(v))
		return parseInt(v);
	if (/^[0-9]*[A-Fa-f]+[0-9A-Fa-f]*$/.test(v))
		return parseInt("0x" + v);
	if (/^-[0-9]*[A-Fa-f]+[0-9A-Fa-f]*$/.test(v)) 
		return parseInt("-0x" + v.substring(1));		
	var offset = parseInt(v);
	if (isNaN(offset)){
		$("#offset").val(0);
		offset = 0;
	}
	return offset;
}
$("#abs_btn").on("click", function() {
	var offset = getOffset();
	//console.log(offset);
	offset = Math.max(0, offset);
	offset = Math.min(offset, totalSize - 1);
	position = offset;
	var scroll = $("#scroll")[0];
	scroll.scrollTop = ((position & ~15) >> 4) * rowHeight;
	getData(rowCount);
});
$("#rel_btn").on("click", function () {
	var offset = getOffset();
	//console.log(offset);
	offset = position + offset;
	offset = Math.max(0, offset);
	offset = Math.min(offset, totalSize - 1);
	position = offset;
	var scroll = $("#scroll")[0];
	scroll.scrollTop = ((position & ~15)>> 4) * rowHeight;
	getData(rowCount);
});

function readBigInt(dataView, offset, littleEndian, unsigned){
	if (littleEndian){
		var low = BigInt(dataView.getUint32(offset, true));
		var high = BigInt(dataView.getUint32(offset + 4, true));
		var n = (high << 32n) | low;
		if(!unsigned)
			n = BigInt.asIntN(64, n);
	}
	else {
		var high = BigInt(dataView.getUint32(offset, false));
		var low = BigInt(dataView.getUint32(offset + 4, false));
		var n = (high << 32n) | low;
		if (!unsigned)
			n = BigInt.asIntN(64, n);
	}
	return n;
}

var lastPos = -1;
$("#table").on("mousemove", function(e){
	var t = e.target;
	var offset = e.offsetX;
	if (t.cellIdx){
		var i = (8.6 * offset / t.clientWidth) | 0;
		var p = t.cellIdx[0] * 16 + t.cellIdx[1] * 8 + i;
		if(p == lastPos)
			return;
		if(i < 8 && p < bytes.length && p >= 0) {
			lastPos = p;
			var y = t.offsetTop + 60;
			var x = t.offsetLeft + i * (t.clientWidth - 10) / 8 - 12;
			var frame = $(".frame")[0];
			var inspector = $("#inspector");
			var data = new Array(...bytes.slice(p, p + 8)).map(function (t) { var n = parseInt(t); return padding(n.toString(16), 2) });
			$("#address")[0].innerText = " address: " + padding((position + p).toString(16), 8) + " data: " + data.join(" ");
			if (y > frame.clientHeight - 100){
				inspector.css({ display: "block", bottom: frame.clientHeight - t.offsetTop + 20, top: "auto", left: x });
				inspector.attr("class", "downArrow");
			}
			else{
				inspector.css({ display: "block", top: y, left: x, bottom: "auto"});
				inspector.attr("class", "upArrow");
			}
			var dataView = new DataView(bytes.buffer);
			var littleEndian = !$("#bigendian").is(':checked');
			var unsigned = $("#unsigned").is(':checked');
			$("#int8")[0].innerText = unsigned ? bytes[p] : dataView.getInt8(p);
			if(p < bytes.length - 1)
				$("#int16")[0].innerText = unsigned ? dataView.getUint16(p, littleEndian) : dataView.getInt16(p, littleEndian);
			else
				$("#int16")[0].innerText = "";
			if (p < bytes.length - 3){
				$("#int32")[0].innerText = unsigned ? dataView.getUint32(p, littleEndian) : dataView.getInt32(p, littleEndian);
				$("#float32")[0].innerText = dataView.getFloat32(p).toPrecision(8);
			}
			else{
				$("#int32")[0].innerText = ""
				$("#float32")[0].innerText = "";
			}
			if (p < bytes.length - 5) {
				$("#int64")[0].innerText = readBigInt(dataView, p, littleEndian, unsigned).toString();
				$("#float64")[0].innerText = dataView.getFloat64(p);
			}
			else{
				$("#float64")[0].innerText = "";
				$("#int64")[0].innerText = "";
			}
			return;
		}
	}
	lastPos = -1;
	$("#inspector").css("display", "none");
});

$("#table").on("mouseleave", function(){
	lastPos = -1;
	//$("#inspector").css("display", "none");
});

$("#scroll span").css("height", rowHeight * (totalSize + 32) >> 4);
$("#scroll").on("scroll", function(e){
	var t = e.target;
	var p = t.scrollTop;
	var totallines = (totalSize + 32) >> 4;
	var pos = (totallines * t.scrollTop / t.scrollHeight + 0.5) | 0;
	position = pos * 16 + (position & 15);
	//console.log("scroll", totallines, t.scrollTop, t.scrollHeight, rowHeight * (totalSize + 32) >> 4, pos, position);
	getData(rowCount);
});
resizeRow(rowCount);
window.onmousewheel = document.onmousewheel = function(e){
	//console.log(e);
	var scroll =  $("#scroll")[0];
	if(e.wheelDelta > 0)
		scroll.scrollTop = Math.max(scroll.scrollTop - rowHeight, 0);
	else 
		scroll.scrollTop = Math.min(scroll.scrollTop + rowHeight, scroll.scrollHeight - scroll.clientHeight);
};
function getData(row) {
	vscode.postMessage({ start: position, end: Math.min(position + row * 16, totalSize) });
}
getData(rowCount);

window.addEventListener("message", function(e){
	var data = e.data;
	//console.log(data);
	var buf = new Uint8Array(data.len);
	for (var i = 0; i < data.len; i++)
		buf[i] = data.data[i];
	fillData(buf);
})
