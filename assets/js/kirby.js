/*星之卡比*/
// -------------------------- utils -------------------------- //

var TAU = Math.PI * 2;

function extend( a, b ) {
    for ( var prop in b ) {
        a[ prop ] = b[ prop ];
    }
    return a;
}

function lerp( a, b, t ) {
    return ( b - a ) * t + a;
}

function modulo( num, div ) {
    return ( ( num % div ) + div ) % div;
}

// -------------------------- Vector3 -------------------------- //

function Vector3( position ) {
    this.set( position );
}

Vector3.prototype.set = function( pos ) {
    pos = Vector3.sanitize( pos );
    this.x = pos.x;
    this.y = pos.y;
    this.z = pos.z;
    return this;
};

Vector3.prototype.rotate = function( rotation ) {
    if ( !rotation ) {
        return;
    }
    this.rotateZ( rotation.z );
    this.rotateY( rotation.y );
    this.rotateX( rotation.x );
    return this;
};

Vector3.prototype.rotateZ = function( angle ) {
    rotateProperty( this, angle, 'x', 'y' );
};

Vector3.prototype.rotateX = function( angle ) {
    rotateProperty( this, angle, 'y', 'z' );
};

Vector3.prototype.rotateY = function( angle ) {
    rotateProperty( this, angle, 'x', 'z' );
};

function rotateProperty( vec, angle, propA, propB ) {
    if ( angle % TAU === 0 ) {
        return;
    }
    var cos = Math.cos( angle );
    var sin = Math.sin( angle );
    var a = vec[ propA ];
    var b = vec[ propB ];
    vec[ propA ] = a*cos - b*sin;
    vec[ propB ] = b*cos + a*sin;
}

Vector3.prototype.add = function( vec ) {
    if ( !vec ) {
        return;
    }
    vec = Vector3.sanitize( vec );
    this.x += vec.x;
    this.y += vec.y;
    this.z += vec.z;
    return this;
};

Vector3.prototype.multiply = function( vec ) {
    if ( !vec ) {
        return;
    }
    vec = Vector3.sanitize( vec );
    this.x *= vec.x;
    this.y *= vec.y;
    this.z *= vec.z;
    return this;
};

Vector3.prototype.lerp = function( vec, t ) {
    this.x = lerp( this.x, vec.x, t );
    this.y = lerp( this.y, vec.y, t );
    this.z = lerp( this.z, vec.z, t );
    return this;
};

// ----- utils ----- //

// add missing properties
Vector3.sanitize = function( vec ) {
    vec = vec || {};
    vec.x = vec.x || 0;
    vec.y = vec.y || 0;
    vec.z = vec.z || 0;
    return vec;
};

// -------------------------- PathAction -------------------------- //

function PathAction( method, points, previousPoint ) {
    this.method = method;
    this.points = points.map( mapVectorPoint );
    this.renderPoints = points.map( mapVectorPoint );
    this.previousPoint = previousPoint;
    this.endRenderPoint = this.renderPoints[ this.renderPoints.length - 1 ];
    // arc actions come with previous point & corner point
    // but require bezier control points
    if ( method == 'arc' ) {
        this.controlPoints = [ new Vector3(), new Vector3() ];
    }
}

function mapVectorPoint( point ) {
    return new Vector3( point );
}

PathAction.prototype.reset = function() {
    // reset renderPoints back to orignal points position
    var points = this.points;
    this.renderPoints.forEach( function( renderPoint, i ) {
        var point = points[i];
        renderPoint.set( point );
    });
};

PathAction.prototype.transform = function( translation, rotation, scale ) {
    this.renderPoints.forEach( function( renderPoint ) {
        renderPoint.multiply( scale );
        renderPoint.rotate( rotation );
        renderPoint.add( translation );
    });
};

PathAction.prototype.render = function( ctx ) {
    this[ this.method ]( ctx );
};

PathAction.prototype.move = function( ctx ) {
    var point = this.renderPoints[0];
    ctx.moveTo( point.x, point.y );
};

PathAction.prototype.line = function( ctx ) {
    var point = this.renderPoints[0];
    ctx.lineTo( point.x, point.y );
};

PathAction.prototype.bezier = function( ctx ) {
    var cp0 = this.renderPoints[0];
    var cp1 = this.renderPoints[1];
    var end = this.renderPoints[2];
    ctx.bezierCurveTo( cp0.x, cp0.y, cp1.x, cp1.y, end.x, end.y );
};

PathAction.prototype.arc = function( ctx ) {
    var prev = this.previousPoint;
    var corner = this.renderPoints[0];
    var end = this.renderPoints[1];
    var cp0 = this.controlPoints[0];
    var cp1 = this.controlPoints[1];
    cp0.set( prev ).lerp( corner, 9/16 );
    cp1.set( end ).lerp( corner, 9/16 );
    ctx.bezierCurveTo( cp0.x, cp0.y, cp1.x, cp1.y, end.x, end.y );
};

// -------------------------- Shape -------------------------- //

function Shape( options ) {
    this.create( options );
}

Shape.prototype.create = function( options ) {
    // default
    extend( this, Shape.defaults );
    // set options
    setOptions( this, options );

    this.updatePathActions();

    // transform
    this.translate = Vector3.sanitize( this.translate );
    this.rotate = Vector3.sanitize( this.rotate );
    this.scale = extend( { x: 1, y: 1, z: 1 }, this.scale );
    this.scale = Vector3.sanitize( this.scale );
    // children
    this.children = [];
    if ( this.addTo ) {
        this.addTo.addChild( this );
    }
};

Shape.defaults = {
    stroke: true,
    fill: false,
    color: 'black',
    lineWidth: 1,
    closed: true,
    rendering: true,
    path: [ {} ],
};

var optionKeys = Object.keys( Shape.defaults ).concat([
    'rotate',
    'translate',
    'scale',
    'addTo',
    'width',
    'height',
]);

function setOptions( shape, options ) {
    for ( var key in options ) {
        if ( optionKeys.includes( key ) ) {
            shape[ key ] = options[ key ];
        }
    }
}

var actionNames = [
    'move',
    'line',
    'bezier',
    'arc',
];

// parse path into PathActions
Shape.prototype.updatePathActions = function() {
    var previousPoint;
    this.pathActions = this.path.map( function( pathPart, i ) {
        // pathPart can be just vector coordinates -> { x, y, z }
        // or path instruction -> { arc: [ {x0,y0,z0}, {x1,y1,z1} ] }
        var keys = Object.keys( pathPart );
        var method = keys[0];
        var points = pathPart[ method ];
        var isInstruction = keys.length === 1 && actionNames.includes( method ) &&
            Array.isArray( points );

        if ( !isInstruction ) {
            method = 'line';
            points = [ pathPart ];
        }

        // first action is always move
        method = i === 0 ? 'move' : method;
        // arcs require previous last point
        var pathAction = new PathAction( method, points, previousPoint );
        // update previousLastPoint
        previousPoint = pathAction.endRenderPoint;
        return pathAction;
    });
};

Shape.prototype.addChild = function( shape ) {
    this.children.push( shape );
};

// ----- update ----- //

Shape.prototype.update = function() {
    // update self
    this.reset();
    // update children
    this.children.forEach( function( child ) {
        child.update();
    });
    this.transform( this.translate, this.rotate, this.scale );
};

Shape.prototype.reset = function() {
    // reset pathAction render points
    this.pathActions.forEach( function( pathAction ) {
        pathAction.reset();
    });
};

Shape.prototype.transform = function( translation, rotation, scale ) {
    // transform points
    this.pathActions.forEach( function( pathAction ) {
        pathAction.transform( translation, rotation, scale );
    });
    // transform children
    this.children.forEach( function( child ) {
        child.transform( translation, rotation, scale );
    });
};

Shape.prototype.updateSortValue = function() {
    var sortValueTotal = 0;
    this.pathActions.forEach( function( pathAction ) {
        sortValueTotal += pathAction.endRenderPoint.z;
    });
    // average sort value of all points
    // def not geometrically correct, but works for me
    this.sortValue = sortValueTotal / this.pathActions.length;
};

// ----- render ----- //

Shape.prototype.render = function( ctx ) {
    var length = this.pathActions.length;
    if ( !this.rendering || !length ) {
        return;
    }
    var isDot = length == 1;
    if ( isDot ) {
        this.renderDot( ctx );
    } else {
        this.renderPath( ctx );
    }
};

// Safari does not render lines with no size, have to render circle instead
Shape.prototype.renderDot = function( ctx ) {
    ctx.fillStyle = this.color;
    var point = this.pathActions[0].endRenderPoint;
    ctx.beginPath();
    var radius = this.lineWidth/2;
    ctx.arc( point.x, point.y, radius, 0, TAU );
    ctx.fill();
};

Shape.prototype.renderPath = function( ctx ) {
    // set render properties
    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth;

    // render points
    ctx.beginPath();
    this.pathActions.forEach( function( pathAction ) {
        pathAction.render( ctx );
    });
    var isTwoPoints = this.pathActions.length == 2 &&
        this.pathActions[1].method == 'line';
    if ( !isTwoPoints && this.closed ) {
        ctx.closePath();
    }
    if ( this.stroke ) {
        ctx.stroke();
    }
    if ( this.fill ) {
        ctx.fill();
    }
};

// return Array of self & all child shapes
Shape.prototype.getShapes = function() {
    var shapes = [ this ];
    this.children.forEach( function( child ) {
        var childShapes = child.getShapes();
        shapes = shapes.concat( childShapes );
    });
    return shapes;
};

Shape.prototype.copy = function( options ) {
    // copy options
    var shapeOptions = {};
    optionKeys.forEach( function( key ) {
        shapeOptions[ key ] = this[ key ];
    }, this );
    // add set options
    setOptions( shapeOptions, options );
    var ShapeClass = this.constructor;
    return new ShapeClass( shapeOptions );
};


// -------------------------- Ellipse -------------------------- //

function Ellipse( options ) {
    options = this.setPath( options );
    // always keep open
    // fixes overlap bug when lineWidth is greater than radius
    options.closed = false;
    this.create( options );
}

Ellipse.prototype = Object.create( Shape.prototype );
Ellipse.prototype.constructor = Ellipse;

Ellipse.prototype.setPath = function( options ) {
    var w = options.width/2;
    var h = options.height/2;
    options.path = [
        { x: 0, y: -h },
        { arc: [ // top right
                { x: w, y: -h },
                { x: w, y: 0 },
            ]},
        { arc: [ // bottom right
                { x: w, y: h },
                { x: 0, y: h },
            ]},
        { arc: [ // bottom left
                { x: -w, y: h },
                { x: -w, y: 0 },
            ]},
        { arc: [ // bottom left
                { x: -w, y: -h },
                { x: 0, y: -h },
            ]},
    ];
    return options;
};

// -------------------------- Group -------------------------- //

function Group( options ) {
    this.create( options );
}

Group.prototype.create = function( options ) {
    // set options
    setGroupOptions( this, options );

    // transform
    this.translate = Vector3.sanitize( this.translate );
    this.rotate = Vector3.sanitize( this.rotate );
    // children
    this.children = [];
    if ( this.addTo ) {
        this.addTo.addChild( this );
    }
};

var groupOptionKeys = [
    'rotate',
    'translate',
    'addTo',
];

function setGroupOptions( shape, options ) {
    for ( var key in options ) {
        if ( groupOptionKeys.includes( key ) ) {
            shape[ key ] = options[ key ];
        }
    }
}


Group.prototype.addChild = function( shape ) {
    this.children.push( shape );
};

// ----- update ----- //

Group.prototype.update = function() {
    // update self
    this.reset();
    // update children
    this.children.forEach( function( child ) {
        child.update();
    });
    this.transform( this.translate, this.rotate );
};

Group.prototype.reset = function() {};

Group.prototype.transform = function( translation, rotation ) {
    // transform children
    this.children.forEach( function( child ) {
        child.transform( translation, rotation );
    });
};

Group.prototype.updateSortValue = function() {
    var sortValueTotal = 0;
    this.children.forEach( function( child ) {
        child.updateSortValue();
        sortValueTotal += child.sortValue;
    });
    // TODO sort children?
    // average sort value of all points
    // def not geometrically correct, but works for me
    this.sortValue = sortValueTotal / this.children.length;
};

// ----- render ----- //

Group.prototype.render = function( ctx ) {
    this.children.forEach( function( child ) {
        child.render( ctx );
    });
};

// do not include children, group handles rendering & sorting internally
Group.prototype.getShapes = function() {
    return [ this ];
};

// -------------------------- Dragger -------------------------- //

// quick & dirty drag event stuff
// messes up if multiple pointers/touches

// event support, default to mouse events
var downEvent = 'mousedown';
var moveEvent = 'mousemove';
var upEvent = 'mouseup';
if ( window.PointerEvent ) {
    // PointerEvent, Chrome
    downEvent = 'pointerdown';
    moveEvent = 'pointermove';
    upEvent = 'pointerup';
} else if ( 'ontouchstart' in window ) {
    // Touch Events, iOS Safari
    downEvent = 'touchstart';
    moveEvent = 'touchmove';
    upEvent = 'touchend';
}

function noop() {}

function Dragger( options ) {
    this.startElement = options.startElement;
    this.onPointerDown = options.onPointerDown || noop;
    this.onPointerMove = options.onPointerMove || noop;
    this.onPointerUp = options.onPointerUp || noop;

    this.startElement.addEventListener( downEvent, this );
}

Dragger.prototype.handleEvent = function( event ) {
    var method = this[ 'on' + event.type ];
    if ( method ) {
        method.call( this, event );
    }
};

Dragger.prototype.onmousedown =
    Dragger.prototype.onpointerdown = function( event ) {
        this.pointerDown( event, event );
    };

Dragger.prototype.ontouchstart = function( event ) {
    this.pointerDown( event, event.changedTouches[0] );
};

Dragger.prototype.pointerDown = function( event, pointer ) {
    event.preventDefault();
    this.dragStartX = pointer.pageX;
    this.dragStartY = pointer.pageY;
    window.addEventListener( moveEvent, this );
    window.addEventListener( upEvent, this );
    this.onPointerDown( pointer );
};

Dragger.prototype.ontouchmove = function( event ) {
    // HACK, moved touch may not be first
    this.pointerMove( event, event.changedTouches[0] );
};

Dragger.prototype.onmousemove =
    Dragger.prototype.onpointermove = function( event ) {
        this.pointerMove( event, event );
    };

Dragger.prototype.pointerMove = function( event, pointer ) {
    event.preventDefault();
    var moveX = pointer.pageX - this.dragStartX;
    var moveY = pointer.pageY - this.dragStartY;
    this.onPointerMove( pointer, moveX, moveY );
};

Dragger.prototype.onmouseup =
    Dragger.prototype.onpointerup =
        Dragger.prototype.ontouchend =
            Dragger.prototype.pointerUp = function( event ) {
                window.removeEventListener( moveEvent, this );
                window.removeEventListener( upEvent, this );
                this.onPointerUp( event );
            };

// -------------------------- demo -------------------------- //

var canvas = document.querySelector('canvas');
var ctx = canvas.getContext('2d');
var w = 80;
var h = 80;
var minWindowSize = Math.min( window.innerWidth, window.innerHeight );
var zoom = Math.min( 7, Math.floor( minWindowSize / w ) );
var pixelRatio = window.devicePixelRatio || 1;
zoom *= pixelRatio;
var canvasWidth = canvas.width = w * zoom;
var canvasHeight = canvas.height = h * zoom;
// set canvas screen size
if ( pixelRatio > 1 ) {
    canvas.style.width = canvasWidth / pixelRatio + 'px';
    canvas.style.height = canvasHeight / pixelRatio + 'px';
}

var isRotating = true;

// colors
var pink = '#F8B';
var blush = '#F5A';
var black = '#333';
var shoe = '#D03';
var red = '#E10';
var yellow = '#FD0';

var camera = new Shape({
    rendering: false,
});

// -- illustration shapes --- //

var body = new Shape({
    lineWidth: 22,
    translate: { y: 11 },
    rotate: { x: -0.3, z: 0.1 },
    addTo: camera,
    color: pink,
});

var face = new Shape({
    rendering: false,
    translate: { z: -10.5 },
    addTo: body,
});

[ -1, 1 ].forEach( function( xSide ) {
    var eyeGroup = new Group({
        addTo: face,
        translate: { x: 2.4*xSide, y: -2 },
        rotate: { x: -0.1 },
    });
    // eye
    new Ellipse({
        width: 1.4,
        height: 5.5,
        addTo: eyeGroup,
        lineWidth: 1,
        color: black,
        fill: true,
    });
    // eye highlight
    new Ellipse({
        width: 1,
        height: 2,
        addTo: eyeGroup,
        translate: { y: -1.5, z: -0.5 },
        lineWidth: 0.5,
        color: '#FFF',
        fill: true,
    });

    // cheek holder
    var cheekHolder = new Shape({
        rendering: false,
        addTo: body,
        rotate: { y: 0.6*xSide },
    });

    new Ellipse({
        width: 2.5,
        height: 1,
        translate: { y: 1, z: -10.5 },
        addTo: cheekHolder,
        color: blush,
        lineWidth: 1,
    });

});

// mouth
new Shape({
    path: [
        { x: 0, y: 0 },
        { bezier: [
                { x: 1.1, y: 0 },
                { x: 1.1, y: 0.2 },
                { x: 1.1, y: 0.5 },
            ]},
        { bezier: [
                { x: 1.1, y: 1.1 },
                { x: 0.2, y: 1.8 },
                { x: 0, y: 1.8 },
            ]},
        { bezier: [
                { x: -0.2, y: 1.8 },
                { x: -1.1, y: 1.1 },
                { x: -1.1, y: 0.5 },
            ]},
        { bezier: [
                { x: -1.1, y: 0.2 },
                { x: -1.1, y: 0 },
                { x: 0, y: 0 },
            ]},
    ],
    addTo: face,
    translate: { y: 2, z: 0.5 },
    lineWidth: 1,
    color: shoe,
    fill: true,
});

var rightArm = new Shape({
    path: [
        { y: 0 },
        { y: -7 },
    ],
    addTo: body,
    translate: { x: -6, y: -4, z: 0 },
    color: pink,
    lineWidth: 7,
});

// left arm
rightArm.copy({
    path: [
        { x: 0 },
        { x: 6 },
    ],
    translate: { x: 6, y: -2, z: 0 },
});

// right foot
var rightFoot = new Shape({
    path: [
        { x: 0, y: -2 },
        { arc: [
                { x: 2, y: -2 },
                { x: 2, y: 0 },
            ]},
        { arc: [
                { x: 2, y: 5 },
                { x: 0, y: 5 },
            ]},
        { arc: [
                { x: -2, y: 5 },
                { x: -2, y: 0 },
            ]},
        { arc: [
                { x: -2, y: -2 },
                { x: 0, y: -2 },
            ]},
    ],
    addTo: body,
    translate: { x: -1, y: 9, z: 9 },
    rotate: { z: -0.2 },
    lineWidth: 6,
    color: shoe,
    fill: true,
    closed: false,
});

rightFoot.copy({
    translate: { x: 9.5, y: 6, z: 6 },
    rotate: { z: -1.1, y: -0.8 }
});

// ----- umbrella ----- //

// umbrella rod
var umbrella = new Shape({
    path: [
        { y: 0 },
        { y: 22 },
    ],
    addTo: rightArm,
    translate: { y: -33, z: -2 },
    rotate: { y: -0.5 },
    color: yellow,
    lineWidth: 1,
});

// star
var starPath = ( function() {
    var path = [];
    var starRadiusA = 3;
    var starRadiusB = 1.7;
    for ( var i=0; i<10; i++ ) {
        var radius = i % 2 ? starRadiusA : starRadiusB;
        var angle = TAU * i/10 + TAU/4;
        var point = {
            x: Math.cos( angle ) * radius,
            y: Math.sin( angle ) * radius,
        };
        path.push( point );
    }
    return path;
})();
// star shape
var star = new Shape({
    path: starPath,
    addTo: umbrella,
    translate: { y: -4.5 },
    lineWidth: 2,
    color: yellow,
    fill: true,
});

// umbrella handle
new Shape({
    path: [
        { z: 0, y: 0 },
        { z: 0, y: 1 },
        { arc: [
                { z: 0, y: 4 },
                { z: -3, y: 4 },
            ]},
        { arc: [
                { z: -6, y: 4 },
                { z: -6, y: 1 },
            ]},
    ],
    addTo: umbrella,
    translate: { y: 23 },
    lineWidth: 2,
    color: '#37F',
    closed: false,
});

// umbrella shield panels
( function() {
    var umbPanelX = 14 * Math.sin( TAU/24 );
    var umbPanelZ = 14 * Math.cos( TAU/24 );
    for ( var i=0; i<12; i++ ) {
        var colorSide = Math.floor( i / 2 ) % 2;
        new Shape({
            path: [
                { x: 0, y: 0, z: 0 },
                { arc: [
                        { x: -umbPanelX, y: 0, z: -umbPanelZ },
                        { x: -umbPanelX, y: 14, z: -umbPanelZ },
                    ]},
                { x: umbPanelX, y: 14, z: -umbPanelZ },
                { arc: [
                        { x: umbPanelX, y: 0, z: -umbPanelZ },
                        { x: 0, y: 0, z: 0 },
                    ]},
            ],
            addTo: umbrella,
            rotate: { y: TAU/12 * i },
            lineWidth: 1,
            color: colorSide ? red : 'white',
            fill: true,
        });
    }
})();

// ----- floater stars ----- //

( function() {
    for ( var i=0; i < 6; i++ ) {
        var starHolder = new Shape({
            rendering: false,
            addTo: umbrella,
            translate: { y: 10 },
            rotate: { y: TAU/6 * i + TAU/24 },
        });
        star.copy({
            addTo: starHolder,
            translate: { z: 28 },
        });
    }
})();

// -----  ----- //

var shapes = camera.getShapes();

// -- animate --- //

function animate() {
    update();
    render();
    requestAnimationFrame( animate );
}

animate();

// -- update -- //

function update() {
    camera.rotate.y += isRotating ? +TAU/150 : 0;

    // rotate
    camera.update();
    shapes.forEach( function( shape ) {
        shape.updateSortValue();
    });
    // perspective sort
    shapes.sort( function( a, b ) {
        return b.sortValue - a.sortValue;
    });
}

// -- render -- //

function render() {
    ctx.clearRect( 0, 0, canvasWidth, canvasHeight );
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.save();
    ctx.scale( zoom, zoom );
    ctx.translate( w/2, h/2 );

    shapes.forEach( function( shape ) {
        shape.render( ctx );
    });

    ctx.restore();
}

// ----- inputs ----- //

// click drag to rotate
var dragStartAngleX, dragStartAngleY;

new Dragger({
    startElement: canvas,
    onPointerDown: function() {
        isRotating = false;
        dragStartAngleX = camera.rotate.x;
        dragStartAngleY = camera.rotate.y;
    },
    onPointerMove: function( pointer, moveX, moveY ) {
        var angleXMove = moveY / canvasWidth * TAU;
        var angleYMove = moveX / canvasWidth * TAU;
        camera.rotate.x = dragStartAngleX + angleXMove;
        camera.rotate.y = dragStartAngleY + angleYMove;
    },
});
