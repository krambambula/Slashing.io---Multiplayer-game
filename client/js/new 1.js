
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>p2.js Platformer example</title>
    <meta charset="utf-8">
    <script src="../../build/p2.js"></script>
  </head>
  <body>

    <!-- The canvas, where we draw stuff -->
    <canvas width="600" height="400" id="myCanvas"></canvas>

    <p>Use arrow keys to control character</p>

    <script>
      var canvas, ctx, w, h, zoom=50, jumpSpeed=6, walkSpeed=2, timeStep=1/60, maxSubSteps=10,
          world, characterBody, planeBody, platforms=[], boxes=[];

      var buttons = {
        space : false,
        left :  false,
        right : false,
      }

      init();
      animate();

      function init(){

        // Init canvas
        canvas = document.getElementById("myCanvas");
        w = canvas.width;
        h = canvas.height;
        ctx = canvas.getContext("2d");
        ctx.lineWidth = 1/zoom;

        // Init world
        world = new p2.World();

        world.defaultContactMaterial.friction = 0.5;
        world.setGlobalStiffness(1e5);

        // Init materials
        var groundMaterial = new p2.Material(),
            characterMaterial = new p2.Material(),
            boxMaterial = new p2.Material();

        // Add a character body
        characterShape = new p2.Box({ width: 0.5, height: 1 });
        characterBody = new p2.Body({
          mass: 1,
          position:[0,3],
          fixedRotation: true,
        });
        characterBody.addShape(characterShape);
        world.addBody(characterBody);
        characterShape.material = characterMaterial;
        characterBody.damping = 0.5;

        // Add a ground plane
        planeShape = new p2.Plane();
        planeBody = new p2.Body({
          position:[0,-1]
        });
        planeBody.addShape(planeShape);
        world.addBody(planeBody);
        planeShape.material = groundMaterial;

        // Add platforms
        var platformPositions = [[2,0],[0,1],[-2,2]];
        for(var i=0; i<platformPositions.length; i++){
          var platformBody = new p2.Body({
            mass: 0, // Static
            position:platformPositions[i],
          });
          platformBody.type = p2.Body.KINEMATIC;
          var platformShape = new p2.Box({ width: 1, height: 0.3 });
          platformShape.material = groundMaterial;
          platformBody.addShape(platformShape);
          world.addBody(platformBody);
          platforms.push(platformBody);
        }

        // Add movable boxes
        var boxPositions = [[2,1],[0,2],[-2,3]];
        for(var i=0; i<boxPositions.length; i++){
          var boxBody = new p2.Body({
            mass: 1,
            position:boxPositions[i],
          });
          var boxShape = new p2.Box({ width: 0.8, height: 0.8 });
          boxShape.material = boxMaterial;
          boxBody.addShape(boxShape);
          world.addBody(boxBody);
          boxes.push(boxBody);
        }

        // Init contactmaterials
        var groundCharacterCM = new p2.ContactMaterial(groundMaterial, characterMaterial,{
          friction : 0.0, // No friction between character and ground
        });
        var boxCharacterCM = new p2.ContactMaterial(boxMaterial, characterMaterial,{
          friction : 0.0, // No friction between character and boxes
        });
        var boxGroundCM = new p2.ContactMaterial(boxMaterial, groundMaterial,{
          friction : 0.6, // Between boxes and ground
        });
        world.addContactMaterial(groundCharacterCM);
        world.addContactMaterial(boxCharacterCM);
        world.addContactMaterial(boxGroundCM);


        // Allow pass through platforms from below
        var passThroughBody;

        world.on('beginContact', function (evt){
          if(evt.bodyA !== characterBody && evt.bodyB !== characterBody) return;
          var otherBody = evt.bodyA === characterBody ? evt.bodyB : evt.bodyA;
          if(platforms.indexOf(otherBody) !== -1 && otherBody.position[1] > characterBody.position[1]){
            passThroughBody = otherBody;
          }
        });

        // Disable any equations between the current passthrough body and the character
        world.on('preSolve', function (evt){
          for(var i=0; i<evt.contactEquations.length; i++){
            var eq = evt.contactEquations[i];
            if((eq.bodyA === characterBody && eq.bodyB === passThroughBody) || eq.bodyB === characterBody && eq.bodyA === passThroughBody){
              eq.enabled = false;
            }
          }
          for(var i=0; i<evt.frictionEquations.length; i++){
            var eq = evt.frictionEquations[i];
            if((eq.bodyA === characterBody && eq.bodyB === passThroughBody) || eq.bodyB === characterBody && eq.bodyA === passThroughBody){
              eq.enabled = false;
            }
          }
        });

        world.on('endContact', function (evt){
          if((evt.bodyA === characterBody && evt.bodyB === passThroughBody) || evt.bodyB === characterBody && evt.bodyA === passThroughBody){
            passThroughBody = undefined;
          }
        });

      }

      function drawBox(body){
        ctx.beginPath();
        var x = body.position[0],
            y = body.position[1],
            s = body.shapes[0];
        ctx.save();
        ctx.translate(x, y);     // Translate to the center of the box
        ctx.rotate(body.angle);  // Rotate to the box body frame
        ctx.fillRect(-s.width/2, -s.height/2, s.width, s.height);
        ctx.restore();
      }

      function drawPlane(){
        var y1 = planeBody.position[1],
            y0 = -h/zoom/2,
            x0 = -w/zoom/2,
            x1 = w/zoom/2;
        ctx.fillRect(x0, y0, x1-x0, y1-y0);
      }

      function render(){
        // Clear the canvas
        ctx.clearRect(0,0,w,h);

        // Transform the canvas
        // Note that we need to flip the y axis since Canvas pixel coordinates
        // goes from top to bottom, while physics does the opposite.
        ctx.save();
        ctx.translate(w/2, h/2);  // Translate to the center
        ctx.scale(zoom, -zoom);   // Zoom in and flip y axis

        // Draw all bodies
        ctx.strokeStyle='none';

        ctx.fillStyle='green';
        drawPlane();
        for(var i=0; i<platforms.length; i++){
          drawBox(platforms[i]);
        }

        ctx.fillStyle='red';
        drawBox(characterBody);
        for(var i=0; i<boxes.length; i++){
          drawBox(boxes[i]);
        }

        // Restore transform
        ctx.restore();
      }

      world.on('postStep', function(){
        for(var i=0; i<platforms.length; i++){
          platforms[i].velocity[0] = 2*Math.sin(world.time);
        }
      });

      var lastTime;

      // Animation loop
      function animate(t){
        requestAnimationFrame(animate);

        var dt = t !== undefined && lastTime !== undefined ? t / 1000 - lastTime : 0;

        // Apply button response
        if(buttons.right)
          characterBody.velocity[0] =  walkSpeed;
        else if(buttons.left)
          characterBody.velocity[0] = -walkSpeed;
        else
          characterBody.velocity[0] = 0;

        // Move physics bodies forward in time
        world.step(timeStep, dt, maxSubSteps);

        // Render scene
        render();

        lastTime = t / 1000;
      }

      var yAxis = p2.vec2.fromValues(0,1);
      function checkIfCanJump(){
        var result = false;
        for(var i=0; i<world.narrowphase.contactEquations.length; i++){
          var c = world.narrowphase.contactEquations[i];
          if(c.bodyA === characterBody || c.bodyB === characterBody){
            var d = p2.vec2.dot(c.normalA, yAxis); // Normal dot Y-axis
            if(c.bodyA === characterBody) d *= -1;
            if(d > 0.5) result = true;
          }
        }
        return result;
      }

      window.onkeydown = function(event){
        switch(event.keyCode){
          case 38: // up
          case 32: // space
            if(!buttons.space){
              if(checkIfCanJump()) characterBody.velocity[1] = jumpSpeed;
              buttons.space = true;
            }
            break;
          case 39: // right
            buttons.right = true;
            break;
          case 37: // left
            buttons.left = true;
            break;
        }
      }

      window.onkeyup = function(event){
        switch(event.keyCode){
          case 38: // up
          case 32: // space
            buttons.space = false;
            break;
          case 39: // right
            buttons.right = false;
            break;
          case 37: // left
            buttons.left = false;
            break;
        }
      }

    </script>

  </body>
</html>
