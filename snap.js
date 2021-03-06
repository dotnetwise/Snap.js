/*
 * Snap.js
 *
 * Copyright 2013, Jacob Kelley - http://jakiestfu.com/
 * Released under the MIT Licence
 * http://opensource.org/licenses/MIT
 *
 * Github:  http://github.com/jakiestfu/Snap.js/
 * Version: 1.9.2
 */
/*jslint browser: true*/
/*global define, module, ender*/
(function (win, doc) {
	'use strict';
	var Snap = Snap || function (userOpts) {
		var settings = {
			element: null,
			element2: null,
			dragger: null,
			disable: 'none',
			addBodyClasses: true,
			hyperextensible: true,
			resistance: 0.5,
			flickThreshold: 50,
			transitionSpeed: 0.3,
			easing: 'ease',
			maxPosition: 266,
			minPosition: -266,
			tapToClose: true,
			touchToDrag: true,
			clickToDrag: true,
			slideIntent: 40, // degrees
			minDragDistance: 5
		},
        cache = {
        	simpleStates: {
        		opening: null,
        		towards: null,
        		hyperExtending: null,
        		halfway: null,
        		flick: null,
        		translation: {
        			absolute: 0,
        			relative: 0,
        			sinceDirectionChange: 0,
        			percentage: 0
        		}
        	}
        },
        eventList = {},
        utils = {
        	hasTouch: (doc.ontouchstart === null),
        	eventType: function (action) {
        		var eventTypes = {
        			down: (utils.hasTouch ? 'touchstart' : settings.clickToDrag ? 'mousedown' : ''),
        			move: (utils.hasTouch ? 'touchmove' : settings.clickToDrag ? 'mousemove' : ''),
        			up: (utils.hasTouch ? 'touchend' : settings.clickToDrag ? 'mouseup' : ''),
        			out: (utils.hasTouch ? 'touchcancel' : settings.clickToDrag ? 'mouseout' : ''),
        		};
        		return eventTypes[action];
        	},
        	page: function (t, e) {
        		return (utils.hasTouch && e.touches.length && e.touches[0]) ? e.touches[0]['page' + t] : e['page' + t];
        	},
        	klass: {
        		has: function (el, name) {
        			return (el.className).indexOf(name) !== -1;
        		},
        		add: function (el, name) {
        			if (!utils.klass.has(el, name) && settings.addBodyClasses) {
        				el.className += " " + name;
        			}
        		},
        		remove: function (el, name) {
        			if (settings.addBodyClasses) {
        				el.className = (el.className).replace(name, "").replace(/^\s+|\s+$/g, '');
        			}
        		}
        	},
        	dispatchEvent: function (type) {
        		if (typeof eventList[type] === 'function') {
        			return eventList[type].call(this);
        		}
        	},
        	vendor: function () {
        		var tmp = doc.createElement("div"),
                    prefixes = 'webkit Moz O ms'.split(' '),
                    i;
        		for (i in prefixes) {
        			if (typeof tmp.style[prefixes[i] + 'Transition'] !== 'undefined') {
        				return prefixes[i];
        			}
        		}
        	},
        	transitionCallback: function () {
        		return (cache.vendor === 'Moz' || cache.vendor === 'ms') ? 'transitionend' : cache.vendor + 'TransitionEnd';
        	},
        	canTransform: function () {
        		return Modernizr.csstransforms3d || typeof settings.element.style[cache.vendor + 'Transform'] !== 'undefined';
        	},
        	deepExtend: function (destination, source) {
        		var property;
        		for (property in source) {
        			if (source[property] && source[property].constructor && source[property].constructor === Object) {
        				destination[property] = destination[property] || {};
        				utils.deepExtend(destination[property], source[property]);
        			} else {
        				destination[property] = source[property];
        			}
        		}
        		return destination;
        	},
        	angleOfDrag: function (x, y) {
        		var degrees, theta;
        		// Calc Theta
        		theta = Math.atan2(-(cache.startDragY - y), (cache.startDragX - x));
        		if (theta < 0) {
        			theta += 2 * Math.PI;
        		}
        		// Calc Degrees
        		degrees = Math.floor(theta * (180 / Math.PI) - 180);
        		if (degrees < 0 && degrees > -180) {
        			degrees = 360 - Math.abs(degrees);
        		}
        		return Math.abs(degrees);
        	},
        	events: {
        		addEvent: function addEvent(element, eventName, func) {
        			if (element.addEventListener) {
        				return element.addEventListener(eventName, func, false);
        			} else if (element.attachEvent) {
        				return element.attachEvent("on" + eventName, func);
        			}
        		},
        		removeEvent: function addEvent(element, eventName, func) {
        			if (element.addEventListener) {
        				return element.removeEventListener(eventName, func, false);
        			} else if (element.attachEvent) {
        				return element.detachEvent("on" + eventName, func);
        			}
        		},
        		prevent: function (e) {
        			if (e.preventDefault) {
        				e.preventDefault();
        			} else {
        				e.returnValue = false;
        			}
        		}
        	},
        	parentUntil: function (el, attr) {
        		var isStr = typeof attr === 'string';
        		while (el.parentNode) {
        			if (isStr && el.getAttribute && el.getAttribute(attr)) {
        				return el;
        			} else if (!isStr && el === attr) {
        				return el;
        			}
        			el = el.parentNode;
        		}
        		return null;
        	}
        },
        action = {
        	translate: {
        		get: {
        			matrix: function (index) {

        				if (!cache.canTransform) {
        					return parseInt(settings.element.style.left, 10);
        				} else {
        					var matrix = win.getComputedStyle(settings.element)[cache.vendor + 'Transform'].match(/\((.*)\)/),
                                ieOffset = 8;
        					if (matrix) {
        						matrix = matrix[1].split(',');
        						if (matrix.length === 16) {
        							index += ieOffset;
        						}
        						return parseInt(matrix[index], 10);
        					}
        					return 0;
        				}
        			}
        		},
        		easeCallback: function () {
        			var key = cache.vendor + 'Transition';
        			settings.element.style[key] = '';
        			$(".snap-fixed, .snap-drag-me-too").css(key, '');
        			cache.translation = action.translate.get.matrix(4);
        			cache.easing = false;
        			clearInterval(cache.animatingInterval);

        			if (cache.easingTo === 0) {
        				utils.klass.remove(doc.body, 'snapjs-right');
        				utils.klass.remove(doc.body, 'snapjs-left');
        			}

        			utils.klass.remove(doc.body, 'snapjs-animating');
        			utils.dispatchEvent('animated');
        			utils.events.removeEvent(settings.element, utils.transitionCallback(), action.translate.easeCallback);
        			if (settings.element2)
        				utils.events.removeEvent(settings.element2, utils.transitionCallback(), action.translate.easeCallback);
        		},
        		easeTo: function (n) {

        			if (!cache.canTransform) {
        				cache.translation = n;
        				action.translate.x(n);
        			} else {
        				cache.easing = true;
        				cache.easingTo = n;

        				var key = cache.vendor + 'Transition';
        				var easing = 'all ' + settings.transitionSpeed + 's ' + settings.easing;
        				settings.element.style[key] = easing;
        				$(".snap-fixed, .snap-drag-me-too").css(key, easing);

        				utils.klass.add(doc.body, 'snapjs-animating');

        				cache.animatingInterval = setInterval(function () {
        					utils.dispatchEvent('animating');
        				}, 1);

        				utils.events.addEvent(settings.element, utils.transitionCallback(), action.translate.easeCallback);
        				if (settings.element2)
        					utils.events.addEvent(settings.element2, utils.transitionCallback(), action.translate.easeCallback);
        				action.translate.x(n);

        				if (n === 0) {
        					var key = cache.vendor + 'Transform';
        					settings.element.style[key] = '';
        					$(".snap-fixed, .snap-drag-me-too").css(key, '');
        				}
        			}
        		},
        		x: function (n) {
        			if ((settings.disable === 'left' && n > 0) ||
                        (settings.disable === 'right' && n < 0)
                    ) { return; }

        			if (!settings.hyperextensible) {
        				if (n === settings.maxPosition || n > settings.maxPosition) {
        					n = settings.maxPosition;
        				} else if (n === settings.minPosition || n < settings.minPosition) {
        					n = settings.minPosition;
        				}
        			}

        			n = parseInt(n, 10);
        			if (isNaN(n)) {
        				n = 0;
        			}
        			//alert(navigator.userAgent);

        			if (cache.canTransform) {
        				var theTranslate = 'translate3d(' + n + 'px, 0,0)';
        				var key = cache.vendor + 'Transform';
        				settings.element.style[key] = theTranslate;
        				$(".snap-fixed, .snap-drag-me-too").css(key, theTranslate);
        			} else {
        				var st = element.style;
        				var style = {
        					width: st.width = (win.innerWidth || doc.documentElement.clientWidth) + 'px',
        					left: st.left = n + 'px',
        					right: st.right = '',
        				}
        				$(".snap-fixed, .snap-drag-me-too").css(style);
        			}
        		}
        	},
        	drag: {
        		listen: function () {
        			cache.translation = 0;
        			cache.easing = false;
        			utils.events.addEvent(settings.element, utils.eventType('down'), action.drag.startDrag);
        			if (settings.element2)
        				utils.events.addEvent(settings.element2, utils.eventType('down'), action.drag.startDrag);
        			if (utils.hasTouch) {
        				utils.events.addEvent(settings.element, utils.eventType('move'), action.drag.dragging);
        				if (settings.element2)
        					utils.events.addEvent(settings.element2, utils.eventType('move'), action.drag.dragging);
        			}
        			utils.events.addEvent(settings.element, utils.eventType('up'), action.drag.endDrag);
        			if (settings.element2)
        				utils.events.addEvent(settings.element2, utils.eventType('up'), action.drag.endDrag);
        		},
        		stopListening: function () {
        			utils.events.removeEvent(settings.element, utils.eventType('down'), action.drag.startDrag);
        			if (settings.element2)
        				utils.events.removeEvent(settings.element2, utils.eventType('down'), action.drag.startDrag);
        			if (utils.hasTouch) {
        				utils.events.removeEvent(settings.element, utils.eventType('move'), action.drag.dragging);
        				if (settings.element2)
        					utils.events.removeEvent(settings.element2, utils.eventType('move'), action.drag.dragging);
        			}
        			utils.events.removeEvent(settings.element, utils.eventType('up'), action.drag.endDrag);
        			if (settings.element2)
        				utils.events.removeEvent(settings.element2, utils.eventType('up'), action.drag.endDrag);
        		},
        		startDrag: function (e) {
        			// No drag on ignored elements
        			var target = e.target ? e.target : e.srcElement,
                        ignoreParent = utils.parentUntil(target, 'data-snap-ignore');

        			if (ignoreParent) {
        				utils.dispatchEvent('ignore');
        				return;
        			}

        			if (!utils.hasTouch) {
        				utils.events.addEvent(settings.element, utils.eventType('move'), action.drag.dragging);
        				if (settings.element2)
        					utils.events.addEvent(settings.element2, utils.eventType('move'), action.drag.dragging);
        			}

        			if (settings.dragger) {
        				var dragParent = utils.parentUntil(target, settings.dragger);

        				// Only use dragger if we're in a closed state
        				if (!dragParent &&
                            (cache.translation !== settings.minPosition &&
                            cache.translation !== settings.maxPosition
                        )) {
        					return;
        				}
        			}

        			utils.dispatchEvent('start');
        			if (cache.canTransform) {
        				var key = cache.vendor + 'Transition';
        				settings.element.style[key] = '';
        				$(".snap-fixed, .snap-drag-me-too").css(key, '');
        			}

        			cache.isDragging = true;
        			cache.hasIntent = null;
        			cache.intentChecked = false;
        			cache.startDragX = utils.page('X', e);
        			cache.startDragY = utils.page('Y', e);
        			cache.dragWatchers = {
        				current: 0,
        				last: 0,
        				hold: 0,
        				state: ''
        			};
        			cache.simpleStates = {
        				opening: null,
        				towards: null,
        				hyperExtending: null,
        				halfway: null,
        				flick: null,
        				translation: {
        					absolute: 0,
        					relative: 0,
        					sinceDirectionChange: 0,
        					percentage: 0
        				}
        			};
        		},
        		dragging: function (e) {
        			if (cache.isDragging && settings.touchToDrag) {

        				var thePageX = utils.page('X', e),
                            thePageY = utils.page('Y', e),
                            translated = cache.translation,
                            absoluteTranslation = action.translate.get.matrix(4),
                            whileDragX = thePageX - cache.startDragX,
                            openingLeft = absoluteTranslation > 0,
                            translateTo = whileDragX,
                            diff;

        				// Shown no intent already
        				if ((cache.intentChecked && !cache.hasIntent)) {
        					return;
        				}

        				if (settings.addBodyClasses) {
        					if ((absoluteTranslation) > 0) {
        						utils.klass.add(doc.body, 'snapjs-left');
        						utils.klass.remove(doc.body, 'snapjs-right');
        					} else if ((absoluteTranslation) < 0) {
        						utils.klass.add(doc.body, 'snapjs-right');
        						utils.klass.remove(doc.body, 'snapjs-left');
        					}
        				}

        				if (cache.hasIntent === false || cache.hasIntent === null) {
        					var deg = utils.angleOfDrag(thePageX, thePageY),
                                inRightRange = (deg >= 0 && deg <= settings.slideIntent) || (deg <= 360 && deg > (360 - settings.slideIntent)),
                                inLeftRange = (deg >= 180 && deg <= (180 + settings.slideIntent)) || (deg <= 180 && deg >= (180 - settings.slideIntent));
        					if (!inLeftRange && !inRightRange) {
        						cache.hasIntent = false;
        					} else {
        						cache.hasIntent = true;
        					}
        					cache.intentChecked = true;
        				}

        				if (
                            (settings.minDragDistance >= Math.abs(thePageX - cache.startDragX)) || // Has user met minimum drag distance?
                            (cache.hasIntent === false)
                        ) {
        					return;
        				}

        				utils.events.prevent(e);
        				utils.dispatchEvent('drag');

        				cache.dragWatchers.current = thePageX;
        				// Determine which direction we are going
        				if (cache.dragWatchers.last > thePageX) {
        					if (cache.dragWatchers.state !== 'left') {
        						cache.dragWatchers.state = 'left';
        						cache.dragWatchers.hold = thePageX;
        					}
        					cache.dragWatchers.last = thePageX;
        				} else if (cache.dragWatchers.last < thePageX) {
        					if (cache.dragWatchers.state !== 'right') {
        						cache.dragWatchers.state = 'right';
        						cache.dragWatchers.hold = thePageX;
        					}
        					cache.dragWatchers.last = thePageX;
        				}
        				if (openingLeft) {
        					// Pulling too far to the right
        					if (settings.maxPosition < absoluteTranslation) {
        						diff = (absoluteTranslation - settings.maxPosition) * settings.resistance;
        						translateTo = whileDragX - diff;
        					}
        					cache.simpleStates = {
        						opening: 'left',
        						towards: cache.dragWatchers.state,
        						hyperExtending: settings.maxPosition < absoluteTranslation,
        						halfway: absoluteTranslation > (settings.maxPosition / 2),
        						flick: Math.abs(cache.dragWatchers.current - cache.dragWatchers.hold) > settings.flickThreshold,
        						translation: {
        							absolute: absoluteTranslation,
        							relative: whileDragX,
        							sinceDirectionChange: (cache.dragWatchers.current - cache.dragWatchers.hold),
        							percentage: (absoluteTranslation / settings.maxPosition) * 100
        						}
        					};
        				} else {
        					// Pulling too far to the left
        					if (settings.minPosition > absoluteTranslation) {
        						diff = (absoluteTranslation - settings.minPosition) * settings.resistance;
        						translateTo = whileDragX - diff;
        					}
        					cache.simpleStates = {
        						opening: 'right',
        						towards: cache.dragWatchers.state,
        						hyperExtending: settings.minPosition > absoluteTranslation,
        						halfway: absoluteTranslation < (settings.minPosition / 2),
        						flick: Math.abs(cache.dragWatchers.current - cache.dragWatchers.hold) > settings.flickThreshold,
        						translation: {
        							absolute: absoluteTranslation,
        							relative: whileDragX,
        							sinceDirectionChange: (cache.dragWatchers.current - cache.dragWatchers.hold),
        							percentage: (absoluteTranslation / settings.minPosition) * 100
        						}
        					};
        				}
        				action.translate.x(translateTo + translated);
        			}
        		},
        		endDrag: function (e) {
        			if (!utils.hasTouch) {
        				utils.events.removeEvent(settings.element, utils.eventType('move'), action.drag.dragging);
        				if (settings.element2)
        					utils.events.removeEvent(settings.element2, utils.eventType('move'), action.drag.dragging);
        			}
        			if (cache.isDragging) {
        				utils.dispatchEvent('end');
        				var translated = action.translate.get.matrix(4);

        				// Tap Close
        				if (cache.dragWatchers.current === 0 && translated !== 0 && settings.tapToClose) {
        					utils.dispatchEvent('close');
        					utils.events.prevent(e);
        					action.translate.easeTo(0);
        					cache.isDragging = false;
        					cache.startDragX = 0;
        					return;
        				}

        				// Revealing Left
        				if (cache.simpleStates.opening === 'left') {
        					// Halfway, Flicking, or Too Far Out
        					if ((cache.simpleStates.halfway || cache.simpleStates.hyperExtending || cache.simpleStates.flick)) {
        						if (cache.simpleStates.flick && cache.simpleStates.towards === 'left') { // Flicking Closed
        							action.translate.easeTo(0);
        						} else if (
                                    (cache.simpleStates.flick && cache.simpleStates.towards === 'right') || // Flicking Open OR
                                    (cache.simpleStates.halfway || cache.simpleStates.hyperExtending) // At least halfway open OR hyperextending
                                ) {
        							action.translate.easeTo(settings.maxPosition); // Open Left
        						}
        					} else {
        						action.translate.easeTo(0); // Close Left
        					}
        					// Revealing Right
        				} else if (cache.simpleStates.opening === 'right') {
        					// Halfway, Flicking, or Too Far Out
        					if ((cache.simpleStates.halfway || cache.simpleStates.hyperExtending || cache.simpleStates.flick)) {
        						if (cache.simpleStates.flick && cache.simpleStates.towards === 'right') { // Flicking Closed
        							action.translate.easeTo(0);
        						} else if (
                                    (cache.simpleStates.flick && cache.simpleStates.towards === 'left') || // Flicking Open OR
                                    (cache.simpleStates.halfway || cache.simpleStates.hyperExtending) // At least halfway open OR hyperextending
                                ) {
        							action.translate.easeTo(settings.minPosition); // Open Right
        						}
        					} else {
        						action.translate.easeTo(0); // Close Right
        					}
        				}
        				cache.isDragging = false;
        				cache.startDragX = utils.page('X', e);
        			}
        		}
        	}
        },
        init = function (opts) {
        	if (opts.element) {
        		utils.deepExtend(settings, opts);
        		cache.vendor = utils.vendor();
        		cache.canTransform = utils.canTransform();
        		action.drag.listen();
        	}
        };
		/*
         * Public
         */
		this.open = function (side) {
			utils.dispatchEvent('open');
			utils.klass.remove(doc.body, 'snapjs-expand-left');
			utils.klass.remove(doc.body, 'snapjs-expand-right');

			if (side === 'left') {
				cache.simpleStates.opening = 'left';
				cache.simpleStates.towards = 'right';
				utils.klass.add(doc.body, 'snapjs-left');
				utils.klass.remove(doc.body, 'snapjs-right');
				action.translate.easeTo(settings.maxPosition);
			} else if (side === 'right') {
				cache.simpleStates.opening = 'right';
				cache.simpleStates.towards = 'left';
				utils.klass.remove(doc.body, 'snapjs-left');
				utils.klass.add(doc.body, 'snapjs-right');
				action.translate.easeTo(settings.minPosition);
			}
		};
		this.close = function () {
			utils.dispatchEvent('close');
			action.translate.easeTo(0);
		};
		this.expand = function (side) {
			var to = win.innerWidth || doc.documentElement.clientWidth;

			if (side === 'left') {
				utils.dispatchEvent('expandLeft');
				utils.klass.add(doc.body, 'snapjs-expand-left');
				utils.klass.remove(doc.body, 'snapjs-expand-right');
			} else {
				utils.dispatchEvent('expandRight');
				utils.klass.add(doc.body, 'snapjs-expand-right');
				utils.klass.remove(doc.body, 'snapjs-expand-left');
				to *= -1;
			}
			action.translate.easeTo(to);
		};

		this.on = function (evt, fn) {
			eventList[evt] = fn;
			return this;
		};
		this.off = function (evt) {
			if (eventList[evt]) {
				eventList[evt] = false;
			}
		};

		this.enable = function () {
			utils.dispatchEvent('enable');
			action.drag.listen();
		};
		this.disable = function () {
			utils.dispatchEvent('disable');
			action.drag.stopListening();
		};

		this.settings = function (opts) {
			utils.deepExtend(settings, opts);
		};

		this.state = function () {
			var state,
                fromLeft = action.translate.get.matrix(4);
			if (fromLeft === settings.maxPosition) {
				state = 'left';
			} else if (fromLeft === settings.minPosition) {
				state = 'right';
			} else {
				state = 'closed';
			}
			return {
				state: state,
				info: cache.simpleStates
			};
		};

		this.toggle = function (side) {
			///<summary>Toggles the snapper (open/closed)</summary>
			///<parameter name="side" type="String">which side to open if it's currently closed. Defaults to 'left'</parameter>
			var side = side || 'left';
			if (this.state().state == 'closed') {
				this.open(side);
			} else {
				this.close();
			}
		}

		init(userOpts);
	};
	if ((typeof module !== 'undefined') && module.exports) {
		module.exports = Snap;
	}
	if (typeof ender === 'undefined') {
		this.Snap = Snap;
	}
	if ((typeof define === "function") && define.amd) {
		define("snap", [], function () {
			return Snap;
		});
	}
	//DETECT screen orientation / maximize changes or even tab activate/deactivate

	var hidden = "hidden";


	// Standards:
	if (hidden in document)
		bindOnChange("visibilitychange");
	else if ((hidden = "mozHidden") in document)
		bindOnChange("mozvisibilitychange");
	else if ((hidden = "webkitHidden") in document)
		bindOnChange("webkitvisibilitychange");
	else if ((hidden = "msHidden") in document)
		bindOnChange("msvisibilitychange");
		// IE 9 and lower:
	else if ('onfocusin' in document)
		document.onfocusin = document.onfocusout = onchange;
		// All others:
	else window.onpageshow = window.onpagehide = window.onfocus = window.onblur = onchange;

	var v = 'tab-visible',
		h = 'tab-hidden',
		evtMap = {
			focus: v,
			focusin: v,
			pageshow: v,
			blur: h,
			focusout: h,
			pagehide: h
		};
	function bindOnChange(eventName) {
		document.addEventListener(eventName, onchange);
	}
	function onchange(evt) {
		evt = evt || window.event;
		$(document.body)
			.removeClass(v + " " + h)
			.addClass(evt && evt.type in evtMap
				? evtMap[evt.type]
				: (this[hidden] ? h : v));
	}
}).call(this, window, document);