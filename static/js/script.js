$(function() {

  $('#cp4').colorpicker({
    format: 'rgb',
    color: '#000000',


  }).on('changeColor', function(e) {
    $('#cp4').css({
      color: e.color.toString('hex')
    });
    penColor = e.color.toString('hex');
  });

  // line size initializer and Handlers

  var lineSizeCanvas = document.createElement('canvas');
  lineSizeCanvas.setAttribute('id', 'lineSizeCanvas');
  $('#lineSizeDiv').append(lineSizeCanvas);
  var lineSizeCanvasContext = lineSizeCanvas.getContext('2d');

  function drawLineExample(size) {
    lineSizeCanvasContext.lineJoin = "round";
    lineSizeCanvasContext.clearRect(0, 0, lineSizeCanvasContext.canvas.width, lineSizeCanvasContext.canvas.height); // Clears the canvas
    lineSizeCanvasContext.beginPath();
    lineSizeCanvasContext.moveTo((lineSizeCanvasContext.canvas.width - 200) / 2, lineSizeCanvasContext.canvas.height / 2);
    var c = 100 / Math.PI / (2);
    for (i = 0; i < 100; i += 1) {
      var x = 50 * Math.sin(i / c);
      lineSizeCanvasContext.lineTo(i + (lineSizeCanvasContext.canvas.width - 200) / 2, lineSizeCanvasContext.canvas.height / 2 + x);
    }
    lineSizeCanvasContext.strokeStyle = '#0096FF';
    lineSizeCanvasContext.lineWidth = size;
    lineSizeCanvasContext.stroke();
  }

  drawLineExample(5);

  $('#ex1').slider({
    formatter: function(value) {
      drawLineExample(value);
      penSize = value;
      return 'Current value: ' + value;
    }
  });



  var canvas = document.createElement('canvas');
  canvas.setAttribute('id', 'canvas');
  $('#canvasDiv').append(canvas);
  var context = canvas.getContext("2d");

  function canvasResize() {
    context.canvas.width = window.innerWidth;
    context.canvas.height = window.innerHeight;
    redraw();
  }

  $(window).resize(canvasResize);

  var socket = new WebSocket('ws' + window.location.href.substr(4));
  var tool = 'p';
  var primitives = new Array();
  var undone = new Array();
  var points = new Array();
  var paint;
  var penSize = 5;
  var penColor = "#000000"
  var beginPoint = null;
  var lastPoint = null;
  canvasResize();

  // handler bottone share link
  $('#shareLink').click(function() {
    window.prompt("Save or share this link", location.href);
  });

  //handler bottone save canvas as image
  $('#saveLink').click(function() {
    if (primitives.length > 0) {
      this.href = canvas.toDataURL('image/png');
      this.download = "mysketch.png";
      setTimeout(function() {$('#saveLink').removeAttr('href')}, 1000);
    } else {
      window.alert("Sorry but the canvas is empty! :(");
    }
  });

  // handler bottone pen tool
  $('#toolPen').click(function() {
    tool = 'p';
  });

  // handler bottone line tool
  $('#toolLine').click(function() {
    tool = 'l';
  });

  //handler bottone box tool
  $('#toolBox').click(function() {
    tool = 'b';
  });

  //handler undo
  function undo() {
    if (primitives.length > 0) {
      undone.push(primitives.pop());
      $('#redoButton').prop("disabled", false);
      redraw();
    }
  }

  $('#undoButton').click(function() {
    undo();
    socket.send(JSON.stringify({
      cmd: 'undo'
    }));
  });

  //handler redo

  function redo() {
    if (undone.length > 0) {
      primitives.push(undone.pop());
      if (undone.length == 0)
        $('#redoButton').prop("disabled", true);
      redraw();
    }
  }

  $('#redoButton').click(function() {
    redo();
    socket.send(JSON.stringify({
      cmd: 'redo'
    }));
  });

  function addClick(x, y, dragging) {
    points.push({
      X: x,
      Y: y,
      drag: dragging
    });
  }

  function addtoPrimitives(obj) {
    primitives.push(obj)
    if (undone.length > 0) {
      undone.splice(0, undone.length);
      $('#redoButton').prop("disabled", true);
    }
  }

  function drawPointList(list, size, color) {
    for (var i = 0; i < list.length; i++) {
      context.beginPath();
      if (list[i].drag && i) {
        context.moveTo(list[i - 1].X, list[i - 1].Y);
      } else {
        context.moveTo(list[i].X - 1, list[i].Y);
      }
      context.strokeStyle = color;
      context.lineWidth = size;
      context.lineTo(list[i].X, list[i].Y);
      context.closePath();
      context.stroke();
    }
  }

  function drawLine(begin, end, size, color) {
    context.beginPath();
    context.moveTo(begin.X, begin.Y);
    context.strokeStyle = color;
    context.lineWidth = size;
    context.lineTo(end.X, end.Y);
    context.closePath();
    context.stroke();
  }

  function drawBox(begin, width, height, size, color) {
    context.strokeStyle = color;
    context.lineWidth = size;
    context.strokeRect(begin.X, begin.Y, width, height);
  }

  function redraw() {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height); // Clears the canvas

    context.lineJoin = "round";
    for (var i = 0; i < primitives.length; i++) {

      switch (primitives[i].type) {
        case 'p':
          drawPointList(primitives[i].pointList, primitives[i].size, primitives[i].color);
          break;
        case 'l':
          drawLine(primitives[i].beginPoint, primitives[i].lastPoint, primitives[i].size, primitives[i].color);
          break;
        case 'b':
          drawBox(primitives[i].beginPoint, primitives[i].width, primitives[i].height, primitives[i].size, primitives[i].color);
          break;
      }
    }

    drawPointList(points, penSize, penColor);

    if (beginPoint && lastPoint) {
      switch (tool) {
        case 'l':
          drawLine(beginPoint, lastPoint, penSize, penColor);
          break;
        case 'b':
          drawBox(beginPoint, lastPoint.X - beginPoint.X, lastPoint.Y - beginPoint.Y, penSize, penColor);
          break;
      }
    }
  }

  // Mouse Handlers

  $('#canvas').on('mousedown touchstart', function(e) {
    paint = true;
    var currX, currY;
    if (e.touches) {
      currX = e.touches[0].pageX - e.touches[0].target.offsetLeft;
      currY = e.touches[0].pageY - e.touches[0].target.offsetTop;
    } else {
      currX = e.pageX - this.offsetLeft;
      currY = e.pageY - this.offsetTop;
    }
    switch (tool) {
      case 'p':
        addClick(currX, currY);
        break;
      case 'l':
      case 'b':
        beginPoint = {
          X: currX,
          Y: currY
        };
        break;
    }
    redraw();
    event.preventDefault();
  });

  $('#canvas').on('mousemove touchmove', function(e) {
    if (paint) {
      var currX, currY;
      if (e.touches) {
        currX = e.touches[0].pageX - e.touches[0].target.offsetLeft;
        currY = e.touches[0].pageY - e.touches[0].target.offsetTop;
      } else {
        currX = e.pageX - this.offsetLeft;
        currY = e.pageY - this.offsetTop;
      }
      switch (tool) {
        case 'p':
          addClick(currX, currY, true);
          break;
        case 'l':
        case 'b':
          lastPoint = {
            X: currX,
            Y: currY
          };
          break;
      }
      redraw();
    }
    event.preventDefault();
  });

  $('#canvas').on('mouseup touchend', function(e) {
    var object = {
      size: penSize,
      color: penColor
    };
    paint = false;
    switch (tool) {
      case 'p':
        object.type = 'p';
        object.pointList = points;
        break;
      case 'l':
        object.beginPoint = beginPoint;
        object.lastPoint = lastPoint;
        object.type = 'l';
        break;
      case 'b':
        object.beginPoint = beginPoint;
        object.width = lastPoint.X - beginPoint.X;
        object.height = lastPoint.Y - beginPoint.Y;
        object.type = 'b';
        break;
    }
    addtoPrimitives(object);
    socket.send(JSON.stringify({
      cmd: 'add',
      data: object
    }));

    // reinizializzo le strutture dati per la creazione di nuove primitive
    points = new Array();
    beginPoint = null;
    lastPoint = null;
  });

  socket.onopen = function() {
    setInterval(ping, 10000);
  }

  function ping() {
    socket.send("__ping__");
    tm = setTimeout(function() {
      /// ---connection closed
      if (confirm("Connection Lost!") == true)
        location.reload();
    }, 5000);
  }
  // socket receive Handlers
  socket.onmessage = function(e) {
    if (e.data === '__pong__') {
      clearTimeout(tm);
      return;
    }
    var pkt = JSON.parse(e.data);
    switch (pkt.cmd) {
      case 'add':
        addtoPrimitives(pkt.data)
        break;
      case 'undo':
        undo();
        break;
      case 'redo':
        redo();
        break;
      case 'digest':
        primitives = pkt.data;
        break;
    }
    redraw();
  }

});
