
'use strict';

const Game = (function() {

  // Supporting mouse and touch events
  var isTouch = 'ontouchstart' in window;
  var touchstart = isTouch ? 'touchstart' : 'mousedown';
  var touchmove = isTouch ? 'touchmove' : 'mousemove';
  var touchend = isTouch ? 'touchend' : 'mouseup';

  var getX = (function getXWrapper() {
    return isTouch ? function(e) { return e.touches[0].pageX; } :
                     function(e) { return e.pageX; };
  })();

  var getY = (function getYWrapper() {
    return isTouch ? function(e) { return e.touches[0].pageY; } :
                     function(e) { return e.pageY; };
  })();

  var vibrate = (function vibrateWrapper() {
    return 'vibrate' in navigator ? function(t) { navigator.vibrate(t) } :
                                    function() { /* noop */ };
  })();

  var image, dimensions;

  var puzzle = document.querySelector('#tiles');
  var winView = document.querySelector('#win');

  var tiles, startX, startY, lastX, lastY;

  var dragTile, sourceTile;

  var rows = 4;

  var levelRadios = document.querySelectorAll('input[name="level"]');
  for (var i = 0; i < levelRadios.length; i++) {
    levelRadios[i].addEventListener('change', function onChange(e) {
      rows = e.target.value;
    });
  }

  const DRAGGING_TRANSITION = '-moz-transform .3s';

  // Long press delay
  const PICK_DELAY = 200;

  // Timeout var to cancel the long press when the user releases the finger
  var pickTimeout = null;

  // It cancels the long press
  function cancelLongPress() {
    clearTimeout(pickTimeout);
    pickTimeout = null;
  }

  function handleLongPress(evt) {
    evt.stopPropagation();
    evt.preventDefault();

    sourceTile = evt.target;

    if (!'position' in sourceTile.dataset)
      return;

    pickTimeout = setTimeout(function pressed() {
      window.removeEventListener(touchend, cancelLongPress);
      pickTile(evt);
    }, PICK_DELAY);

    window.addEventListener(touchend, cancelLongPress);
  }

  function pickTile(evt) {
    window.addEventListener(touchend, handleEndEvent);

    dragTile = sourceTile.cloneNode();
    dragTile.classList.add('draggable');
    dragTile.style.MozTransform = 'translate(0,0) scale(1.2)';
    var rectangle = sourceTile.getBoundingClientRect();
    var style = dragTile.style;
    style.left = rectangle.left + 'px';
    style.top = rectangle.top + 'px';
    document.body.appendChild(dragTile);

    startX = lastX = getX(evt);
    startY = lastY = getY(evt);

    puzzle.removeEventListener(touchstart, handleLongPress);
    window.addEventListener(touchmove, handleMoveEvent);

    sourceTile.style.opacity = 0;
  }

  function handleMoveEvent(e) {
    lastX = getX(e);
    lastY = getY(e);
    dragTile.style.MozTransform =
          'translate(' + (lastX - startX) + 'px,' + (lastY - startY) +
          'px) scale(1.2)';
  }

  function handleEndEvent(e) {
    window.removeEventListener(touchmove, handleMoveEvent);
    window.removeEventListener(touchend, handleEndEvent);

    var targetTile = document.elementFromPoint(lastX, lastY);

    var sourceIndex = tiles.indexOf(sourceTile);
    var targetIndex = tiles.indexOf(targetTile);
    if (targetIndex !== -1 && sourceIndex !== targetIndex) {
      translate(sourceTile, sourceIndex, targetIndex);
      translate(targetTile, targetIndex, sourceIndex, DRAGGING_TRANSITION);
      targetTile.addEventListener('transitionend', function transitionend() {
        targetTile.removeEventListener('transitionend', transitionend);
        if (sourceTile.dataset.position === targetIndex.toString())
          vibrate([100]);
        tiles[sourceIndex] = targetTile;
        tiles[targetIndex] = sourceTile;
        targetTile.style.MozTransition = '';
        sourceTile.style.opacity = 1;
        document.body.removeChild(dragTile);
        puzzle.addEventListener(touchstart, handleLongPress);
        setTimeout(checkTheEnd);
      });
    } else {
      sourceTile.style.opacity = 1;
      document.body.removeChild(dragTile);
      puzzle.addEventListener(touchstart, handleLongPress);
      setTimeout(checkTheEnd);
    }
  }

  function translate(node, from, to, transition) {
    var x = node.dataset.x = parseInt(node.dataset.x || 0) +
            (Math.floor(to % rows) - Math.floor(from % rows)) * 100;

    var y = node.dataset.y = parseInt(node.dataset.y || 0) +
            (Math.floor(to / rows) - Math.floor(from / rows)) * 100;

    window.mozRequestAnimationFrame(function() {
      node.style.MozTransform = 'translate(' + x + '%, ' + y + '%)';
      if (transition)
        node.style.MozTransition = transition;
    });
  }

  function checkTheEnd() {
    var end = true;

    for (var position = 0; position < rows * rows; position++) {
      if (position.toString() !== tiles[position].dataset.position) {
        end = false;
        break;
      }
    }

    if (end) {
      winView.classList.add('show');
    }
  }

  function buildImage(tile) {
    var canvas = document.createElement('canvas');
    canvas.width = dimensions[0];
    canvas.height = dimensions[1];

    var context = canvas.getContext('2d');

    var x = (tile % rows) * dimensions[0];
    var y = Math.floor(tile / rows) * dimensions[1];

    context.drawImage(image, x, y, dimensions[0], dimensions[1],
                      0, 0, dimensions[0], dimensions[1]);

    canvas.toBlob(function(blob) {
      var img = document.createElement('img');
      img.src = window.URL.createObjectURL(blob);
      img.dataset.position = tile;
      puzzle.appendChild(img);
      if (puzzle.children.length === rows * rows) {
        tiles = Array.prototype.slice.call(puzzle.children, 0,
                                           puzzle.children.length);
        puzzle.addEventListener(touchstart, handleLongPress);
      }
    });
  }

  function build(image) {
    tiles = [];

    for (var i = 0; i < rows * rows; i++) {
      tiles.push(i);
    }

    tiles.shuffle();
    tiles.forEach(buildImage);
  }

  function initialize(src, success) {
    puzzle.innerHTML = '';

    image = new Image();

    image.addEventListener('load', function onLoad(e) {
      image.removeEventListener('load', onLoad);
      dimensions = [image.width / rows, image.height / rows];
      build(image);
      success();
    });

    image.src = src;
  }

  function destroy() {
    puzzle.removeEventListener(touchstart, handleLongPress);
    window.removeEventListener(touchmove, handleMoveEvent);
    window.removeEventListener(touchend, handleEndEvent);
    winView.classList.remove('show');
    tiles = null;
  }

  return {
    start: initialize,

    end: destroy,

    get rows() {
      return rows;
    }
  };

}());

Array.prototype.shuffle = function shuffle() {
  for (var i = this.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = this[i];
    this[i] = this[j];
    this[j] = tmp;
  }

  return this;
};
