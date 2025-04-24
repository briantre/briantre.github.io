// Arkanoid Game

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');

// Set canvas dimensions
canvas.width = 800;
canvas.height = 600;

// Game variables
let score = 0;
let lives = 3;
let level = 1;
let gameOver = false;
let gamePaused = false;
let gameStarted = false;

// Animation state variables
let levelTransitioning = false;
let hallwayAnimation = {
    active: false,
    progress: 0,
    speed: 0.02,
    duration: 15000, // 15 seconds
    startTime: 0
};
let brickRotationAnimation = {
    active: false,
    progress: 0,
    startTime: 0,
    duration: 1500,
    staggerDelay: 50 // ms between each brick's animation start
};

// Bullet cooldown system
let lastBulletTime = 0;
const bulletCooldown = 1000; // 1000ms = 1 second between shots

// Powerup variables
const powerupTypes = {
    WIDE: 0,    // Wide paddle
    SHOOT: 1,   // Shoot bullets
    SPEED: 2,   // Speed boost
    STICKY: 3   // Sticky paddle
};

const powerups = [];
const bullets = [];

// Active powerup states
let activePowerups = {
    wide: false,
    shoot: false,
    speed: false,
    sticky: false
};

// Timer IDs for powerup durations
let powerupTimers = {
    wide: null,
    shoot: null,
    speed: null, 
    sticky: null
};

// Original paddle properties (for restoring after powerups)
let originalPaddleWidth = 80;
let originalMaxVelocity = 8;

// Store if ball is stuck to paddle
let ballStuckToPaddle = false;
let ballStuckOffset = 0;

// Colors
const colors = [
    '#FF0055', // Neon pink
    '#00FFAA', // Cyan green
    '#4400FF', // Electric purple
    '#22FFFF', // Bright cyan
    '#FF9500', // Bright orange
    '#00FF66', // Matrix green
    '#AA00FF'  // Deep purple
];

// Add sci-fi brick patterns
const brickPatterns = [
    {pattern: 'circuit', probability: 0.7},
    {pattern: 'grid', probability: 0.3}
];

// Paddle properties
const paddle = {
    x: canvas.width / 2 - 40,
    y: canvas.height - 30,
    width: 80,
    height: 12,
    dx: 8,
    velocity: 0,
    maxVelocity: 8,
    acceleration: 0.9,
    friction: 0.62, // Friction factor (lower = more friction)
    mainColor: '#D3D3D3', // Light gray main body (silver)
    sideColor: '#FF0000', // Red side sections
    borderColor: '#000000', // Black border
    capWidth: 6, // Width of the colored end caps
    
    // Battlestar Galactica spaceship properties
    shipHullColor: '#707070', // Metallic gray for main hull
    engineGlowColor: '#3399FF', // Blue engine glow
    detailColor: '#AA0000', // Red for details
    accentColor: '#DDDDDD', // Light gray for accents
    armorPlatingColor: '#505050', // Darker gray for armor plating
    engineIntensity: 0.6, // Base engine glow intensity
    thrusters: {
        left: false,  // Left thruster active
        right: false  // Right thruster active
    },
    engineFlickerSpeed: 150, // Speed of engine glow flicker effect (ms)
    isMoving: false // Flag for movement-based effects
}

// Ball properties
const ball = {
    x: canvas.width / 2,
    y: canvas.height - 50,
    radius: 10,
    speed: 5,
    dx: 8,
    dy: -8,
    color: '#FFFFFF'
};

// Brick properties
const brickRowCount = 5;
const brickColumnCount = 9;
const brickWidth = 80;
const brickHeight = 20;
const brickPadding = 10;
const brickOffsetTop = 60;
const brickOffsetLeft = 25;

// Create bricks
const bricks = [];
for (let c = 0; c < brickColumnCount; c++) {
    bricks[c] = [];
    for (let r = 0; r < brickRowCount; r++) {
        bricks[c][r] = {
            x: 0,
            y: 0,
            status: 1,
            color: colors[r % colors.length],
            pattern: Math.random() < 0.5 ? 'circuit' : 'grid',
            pulseOffset: Math.random() * Math.PI * 2, // Random offset for pulsing effect
            glowIntensity: 0.4 + Math.random() * 0.2 // Random base glow
        };
    }
}

// Event listeners
document.addEventListener('keydown', keyDownHandler);
document.addEventListener('keyup', keyUpHandler);
document.addEventListener('mousemove', mouseMoveHandler);
canvas.addEventListener('click', handleCanvasClick);

// Add right click event listener for shooting bullets and releasing sticky ball
canvas.addEventListener('contextmenu', function(e) {
    e.preventDefault(); // Prevent context menu from appearing
    
    // Shoot bullets if powerup is active
    if (activePowerups.shoot && gameStarted && !gamePaused) {
        const currentTime = Date.now();
        if (currentTime - lastBulletTime >= bulletCooldown) {
            // Create two bullets, one from each end of the paddle
            bullets.push({
                x: paddle.x + 10,
                y: paddle.y,
                speed: 7,
                width: 3,
                height: 10,
                color: '#FFFF00'
            });
            
            bullets.push({
                x: paddle.x + paddle.width - 10,
                y: paddle.y,
                speed: 7,
                width: 3,
                height: 10,
                color: '#FFFF00'
            });
            
            lastBulletTime = currentTime;
        }
    }
    
    // Release ball if it's stuck to the paddle
    if (activePowerups.sticky && ballStuckToPaddle) {
        ballStuckToPaddle = false;
        ball.dy = -5; // Launch the ball upward
    }
});

// Key states
const keys = {
    right: false,
    left: false
};

// Key handlers
function keyDownHandler(e) {
    if (e.key === 'Right' || e.key === 'ArrowRight') {
        keys.right = true;
    } else if (e.key === 'Left' || e.key === 'ArrowLeft') {
        keys.left = true;
    } else if (e.key === 'p' || e.key === 'P') {
        togglePause();
    } else if (e.key === ' ' && !gameStarted) {
        startGame();
    } else if (e.key === 'l' || e.key === 'L') {
        // Activate "Last Brick Standing" feature
        if (gameStarted && !gamePaused && !levelTransitioning) {
            activateLastBrickStanding();
        }
    }
}

function keyUpHandler(e) {
    if (e.key === 'Right' || e.key === 'ArrowRight') {
        keys.right = false;
    } else if (e.key === 'Left' || e.key === 'ArrowLeft') {
        keys.left = false;
    }
}

function mouseMoveHandler(e) {
    const relativeX = e.clientX - canvas.offsetLeft;
    if (relativeX > 0 && relativeX < canvas.width) {
        paddle.x = relativeX - paddle.width / 2;
    }
}

function handleCanvasClick() {
    if (gameOver) {
        // Reset the game completely when clicking after game over
        gameOver = false;
        level = 1;
        score = 0;
        lives = 3;
        scoreElement.textContent = score;
        livesElement.textContent = lives;
        resetBallAndPaddle();
        
        // Reset all bricks
        for (let c = 0; c < brickColumnCount; c++) {
            for (let r = 0; r < brickRowCount; r++) {
                bricks[c][r].status = 1;
            }
        }
        
        gameStarted = true;
        draw();
        return;
    }
    
    if (!gameStarted) {
        gameStarted = true;
        draw();
    } else {
        // Toggle pause state when clicking during gameplay
        togglePause();
        
        // If game is paused, show a pause message
        if (gamePaused) {
            showMessage('PAUSED');
            ctx.font = '20px Arial';
            ctx.fillText('Click to resume', canvas.width / 2, canvas.height / 2 + 40);
        }
    }
}

function togglePause() {
    gamePaused = !gamePaused;
    if (!gamePaused) {
        draw();
    }
}

// Powerup functions
function createPowerup(brickX, brickY) {
    // 30% chance to spawn a powerup
    if (Math.random() < 0.3) {
        // Find which brick was broken to determine its color
        let brickColor = '#FFFFFF'; // Default color
        
        for (let c = 0; c < brickColumnCount; c++) {
            for (let r = 0; r < brickRowCount; r++) {
                const brick = bricks[c][r];
                if (brick.x === brickX && brick.y === brickY) {
                    brickColor = brick.color;
                    break;
                }
            }
        }
        
        // If we couldn't find the exact brick, use the row color based on Y position
        if (brickColor === '#FFFFFF') {
            const row = Math.floor((brickY - brickOffsetTop) / (brickHeight + brickPadding));
            if (row >= 0 && row < colors.length) {
                brickColor = colors[row % colors.length];
            }
        }
        
        const type = Math.floor(Math.random() * 4); // 0-3 for the 4 powerup types
        powerups.push({
            x: brickX + brickWidth / 2,
            y: brickY + brickHeight / 2,
            type: type,
            width: 24,
            height: 24,
            speed: 2,
            brickColor: brickColor, // Store the original brick color
            rotation: 0,
            rotationSpeed: Math.random() * 0.05 + 0.02, // Random rotation speed
            glowIntensity: 0.6, // Initial glow intensity
            glowDirection: 1 // Controls glow pulsation
        });
    }
}

function drawPowerups() {
    for (let i = 0; i < powerups.length; i++) {
        const p = powerups[i];
        
        // Update rotation and glow
        p.rotation += p.rotationSpeed;
        p.glowIntensity += 0.02 * p.glowDirection;
        if (p.glowIntensity > 0.9) {
            p.glowDirection = -1;
        } else if (p.glowIntensity < 0.6) {
            p.glowDirection = 1;
        }
        
        // Save context before rotation
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        
        // Draw crystallized powerup
        
        // Crystal base shape with original brick color
        ctx.beginPath();
        ctx.moveTo(-p.width/2, 0);
        ctx.lineTo(0, -p.height/2);
        ctx.lineTo(p.width/2, 0);
        ctx.lineTo(0, p.height/2);
        ctx.closePath();
        ctx.fillStyle = p.brickColor;
        ctx.fill();
        
        // Add crystal facets/highlights with lighter color
        const lighterColor = lightenColor(p.brickColor, 50);
        ctx.beginPath();
        ctx.moveTo(-p.width/3, -p.height/6);
        ctx.lineTo(0, -p.height/2.5);
        ctx.lineTo(p.width/3, -p.height/6);
        ctx.closePath();
        ctx.fillStyle = lighterColor;
        ctx.fill();
        
        // Add crystal facets/highlights with darker color
        const darkerColor = darkenColor(p.brickColor, 30);
        ctx.beginPath();
        ctx.moveTo(-p.width/3, p.height/6);
        ctx.lineTo(0, p.height/2.5);
        ctx.lineTo(p.width/3, p.height/6);
        ctx.closePath();
        ctx.fillStyle = darkerColor;
        ctx.fill();
        
        // Draw crystal outline
        ctx.beginPath();
        ctx.moveTo(-p.width/2, 0);
        ctx.lineTo(0, -p.height/2);
        ctx.lineTo(p.width/2, 0);
        ctx.lineTo(0, p.height/2);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255, 255, 255, ' + p.glowIntensity + ')';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Add a type indicator in the center
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 14px Arial';
        
        let symbol = "";
        switch (p.type) {
            case powerupTypes.WIDE:
                symbol = "W";
                break;
            case powerupTypes.SHOOT:
                symbol = "B";
                break;
            case powerupTypes.SPEED:
                symbol = "S";
                break;
            case powerupTypes.STICKY:
                symbol = "*";
                break;
        }
        
        ctx.fillText(symbol, 0, 0);
        
        // Restore context after rotation
        ctx.restore();
        
        // Add outer glow effect (not affected by rotation)
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(p.x, p.y, p.width/2, p.x, p.y, p.width);
        
        // Determine glow color based on powerup type, but incorporate the brick color
        let glowColor;
        switch (p.type) {
            case powerupTypes.WIDE:
                glowColor = 'rgba(255, 0, 0, ';
                break;
            case powerupTypes.SHOOT:
                glowColor = 'rgba(255, 255, 0, ';
                break;
            case powerupTypes.SPEED:
                glowColor = 'rgba(0, 255, 0, ';
                break;
            case powerupTypes.STICKY:
                glowColor = 'rgba(0, 255, 255, ';
                break;
        }
        
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.7, glowColor + '0)');
        gradient.addColorStop(1, glowColor + p.glowIntensity/2 + ')');
        
        ctx.fillStyle = gradient;
        ctx.arc(p.x, p.y, p.width, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Helper functions to lighten and darken colors for crystal effects
function lightenColor(color, percent) {
    // Convert hex to RGB
    let r, g, b;
    if (color.startsWith('#')) {
        r = parseInt(color.substr(1, 2), 16);
        g = parseInt(color.substr(3, 2), 16);
        b = parseInt(color.substr(5, 2), 16);
    } else if (color.startsWith('rgb')) {
        const rgbValues = color.match(/\d+/g);
        r = parseInt(rgbValues[0]);
        g = parseInt(rgbValues[1]);
        b = parseInt(rgbValues[2]);
    } else {
        return color; // Return original if format not recognized
    }
    
    // Lighten
    r = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
    g = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
    b = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));
    
    return `rgb(${r}, ${g}, ${b})`;
}

function darkenColor(color, percent) {
    // Convert hex to RGB
    let r, g, b;
    if (color.startsWith('#')) {
        r = parseInt(color.substr(1, 2), 16);
        g = parseInt(color.substr(3, 2), 16);
        b = parseInt(color.substr(5, 2), 16);
    } else if (color.startsWith('rgb')) {
        const rgbValues = color.match(/\d+/g);
        r = parseInt(rgbValues[0]);
        g = parseInt(rgbValues[1]);
        b = parseInt(rgbValues[2]);
    } else {
        return color; // Return original if format not recognized
    }
    
    // Darken
    r = Math.max(0, Math.floor(r * (1 - percent / 100)));
    g = Math.max(0, Math.floor(g * (1 - percent / 100)));
    b = Math.max(0, Math.floor(b * (1 - percent / 100)));
    
    return `rgb(${r}, ${g}, ${b})`;
}

// Move powerups
function movePowerups() {
    for (let i = 0; i < powerups.length; i++) {
        powerups[i].y += powerups[i].speed;
        
        // Check for collision with paddle
        if (
            powerups[i].y + powerups[i].height / 2 > paddle.y &&
            powerups[i].y - powerups[i].height / 2 < paddle.y + paddle.height &&
            powerups[i].x + powerups[i].width / 2 > paddle.x &&
            powerups[i].x - powerups[i].width / 2 < paddle.x + paddle.width
        ) {
            activatePowerup(powerups[i].type);
            powerups.splice(i, 1);
            i--;
            continue;
        }
        
        // Remove if it goes off screen
        if (powerups[i].y - powerups[i].height / 2 > canvas.height) {
            powerups.splice(i, 1);
            i--;
        }
    }
}

function activatePowerup(type) {
    switch (type) {
        case powerupTypes.WIDE:
            // Wide paddle powerup (12-40 seconds)
            if (powerupTimers.wide) clearTimeout(powerupTimers.wide);
            
            // Store original width if not already in wide mode
            if (!activePowerups.wide) {
                paddle.width = originalPaddleWidth * 2;
            }
            
            activePowerups.wide = true;
            const wideDuration = Math.floor(Math.random() * 29 + 12) * 1000; // 12-40 seconds
            
            powerupTimers.wide = setTimeout(() => {
                activePowerups.wide = false;
                // Only reset width if no other powerup is keeping it wide
                paddle.width = originalPaddleWidth;
            }, wideDuration);
            break;
            
        case powerupTypes.SHOOT:
            // Shooting powerup (20-45 seconds)
            if (powerupTimers.shoot) clearTimeout(powerupTimers.shoot);
            
            activePowerups.shoot = true;
            const shootDuration = Math.floor(Math.random() * 26 + 20) * 1000; // 20-45 seconds
            
            powerupTimers.shoot = setTimeout(() => {
                activePowerups.shoot = false;
            }, shootDuration);
            break;
            
        case powerupTypes.SPEED:
            // Speed boost powerup (27 seconds)
            if (powerupTimers.speed) clearTimeout(powerupTimers.speed);
            
            // Double the max velocity if not already in speed mode
            if (!activePowerups.speed) {
                paddle.maxVelocity = originalMaxVelocity * 2;
            }
            
            activePowerups.speed = true;
            
            powerupTimers.speed = setTimeout(() => {
                activePowerups.speed = false;
                // Reset max velocity
                paddle.maxVelocity = originalMaxVelocity;
            }, 27000); // 27 seconds
            break;
            
        case powerupTypes.STICKY:
            // Sticky paddle powerup (20 seconds)
            if (powerupTimers.sticky) clearTimeout(powerupTimers.sticky);
            
            activePowerups.sticky = true;
            
            powerupTimers.sticky = setTimeout(() => {
                activePowerups.sticky = false;
                // If ball is stuck to paddle when powerup expires, release it
                if (ballStuckToPaddle) {
                    ballStuckToPaddle = false;
                    ball.dy = -5; // Launch the ball upward
                }
            }, 20000); // 20 seconds
            break;
    }
}

// Bullet functions
function drawBullets() {
    for (let i = 0; i < bullets.length; i++) {
        const b = bullets[i];
        ctx.beginPath();
        ctx.rect(b.x, b.y, b.width, b.height);
        ctx.fillStyle = b.color;
        ctx.fill();
        ctx.closePath();
    }
}

function moveBullets() {
    for (let i = 0; i < bullets.length; i++) {
        bullets[i].y -= bullets[i].speed;
        
        // Check bullet collision with bricks
        let bulletHit = false;
        for (let c = 0; c < brickColumnCount && !bulletHit; c++) {
            for (let r = 0; r < brickRowCount && !bulletHit; r++) {
                const brick = bricks[c][r];
                if (brick.status === 1) {
                    if (
                        bullets[i].x > brick.x &&
                        bullets[i].x < brick.x + brickWidth &&
                        bullets[i].y > brick.y &&
                        bullets[i].y < brick.y + brickHeight
                    ) {
                        // Brick is hit by bullet
                        brick.status = 0;
                        bulletHit = true;
                        score += 10;
                        scoreElement.textContent = score;
                        
                        // Check for powerup spawn
                        createPowerup(brick.x, brick.y);
                        
                        // Check if all bricks are destroyed
                        if (score === brickRowCount * brickColumnCount * 10) {
                            // Start level transition animation instead of directly resetting
                            levelTransitioning = true;
                            hallwayAnimation.active = true;
                            hallwayAnimation.progress = 0;
                            hallwayAnimation.startTime = Date.now();
                            
                            // Start the hallway animation
                            requestAnimationFrame(updateHallwayAnimation);
                            return; // Skip regular win message
                        }
                        
                        // Remove the bullet
                        bullets.splice(i, 1);
                        i--;
                        break;
                    }
                }
            }
        }
        
        // Remove if it goes off screen
        if (!bulletHit && bullets.length > 0 && i >= 0 && bullets[i].y + bullets[i].height < 0) {
            bullets.splice(i, 1);
            i--;
        }
    }
}

// Collision detection
function collisionDetection() {
    for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
            const b = bricks[c][r];
            if (b.status === 1) {
                if (
                    ball.x > b.x &&
                    ball.x < b.x + brickWidth &&
                    ball.y > b.y &&
                    ball.y < b.y + brickHeight
                ) {
                    ball.dy = -ball.dy;
                    b.status = 0;
                    score += 10;
                    scoreElement.textContent = score;
                    
                    // Check for powerup spawn when brick is broken
                    createPowerup(b.x, b.y);

                    // Check if all bricks are destroyed
                    if (score === brickRowCount * brickColumnCount * 10) {
                        showMessage('LEVEL COMPLETE!');
                        // Start level transition animation instead of directly resetting
                        levelTransitioning = true;
                        hallwayAnimation.active = true;
                        hallwayAnimation.progress = 0;
                        hallwayAnimation.startTime = Date.now();
                        
                        // Start the hallway animation
                        requestAnimationFrame(updateHallwayAnimation);
                        return; // Skip regular win message
                    }
                }
            }
        }
    }
}

// Draw functions
function drawBall() {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ball.color;
    ctx.fill();
    ctx.closePath();
}

function drawPaddle() {
    // Update thrusters state based on paddle velocity
    paddle.isMoving = Math.abs(paddle.velocity) > 0.5;
    paddle.thrusters.right = paddle.velocity < -0.5;
    paddle.thrusters.left = paddle.velocity > 0.5;
    
    // Get paddle center for translations
    const centerX = paddle.x + paddle.width/2;
    const centerY = paddle.y + paddle.height/2;
    
    // Save context for transformations
    ctx.save();
    ctx.translate(centerX, centerY);
    
    // Calculate engine glow intensity with flicker effect
    const flicker = Math.sin(Date.now() / paddle.engineFlickerSpeed) * 0.2;
    const engineGlowIntensity = paddle.engineIntensity + flicker;
    
    // Draw the spaceship hull (main body) - slightly larger than the original paddle
    const shipWidth = paddle.width * 0.95;
    const shipHeight = paddle.height * 2.2;
    
    // Draw shadow under ship
    const shadowGradient = ctx.createRadialGradient(0, shipHeight * 0.7, 0, 0, shipHeight * 0.7, shipWidth/1.3);
    shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
    shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.beginPath();
    ctx.ellipse(0, shipHeight * 0.7, shipWidth/2.5, shipHeight/8, 0, 0, Math.PI * 2);
    ctx.fillStyle = shadowGradient;
    ctx.fill();
    
    // Draw main hull structure (Battlestar style)
    ctx.beginPath();
    
    // Define the ship's silhouette
    const hullPath = [
        [-shipWidth/2, -shipHeight*0.2],        // Left mid point
        [-shipWidth*0.35, -shipHeight*0.4],     // Left forward tapered point
        [-shipWidth*0.15, -shipHeight/2],       // Left front slope
        [0, -shipHeight*0.55],                  // Front center point
        [shipWidth*0.15, -shipHeight/2],        // Right front slope
        [shipWidth*0.35, -shipHeight*0.4],      // Right forward tapered point
        [shipWidth/2, -shipHeight*0.2],         // Right mid point
        [shipWidth*0.45, shipHeight*0.1],       // Right rear outward point
        [shipWidth*0.35, shipHeight*0.25],      // Right engine housing
        [shipWidth*0.15, shipHeight*0.3],       // Right inner engine
        [-shipWidth*0.15, shipHeight*0.3],      // Left inner engine
        [-shipWidth*0.35, shipHeight*0.25],     // Left engine housing
        [-shipWidth*0.45, shipHeight*0.1]       // Left rear outward point
    ];
    
    // Draw the hull path
    ctx.moveTo(hullPath[0][0], hullPath[0][1]);
    for (let i = 1; i < hullPath.length; i++) {
        ctx.lineTo(hullPath[i][0], hullPath[i][1]);
    }
    ctx.closePath();
    
    // Create metallic hull gradient
    const hullGradient = ctx.createLinearGradient(-shipWidth/2, -shipHeight/2, shipWidth/2, shipHeight/4);
    hullGradient.addColorStop(0, darkenColor(paddle.shipHullColor, 20));
    hullGradient.addColorStop(0.3, lightenColor(paddle.shipHullColor, 10));
    hullGradient.addColorStop(0.7, paddle.shipHullColor);
    hullGradient.addColorStop(1, darkenColor(paddle.shipHullColor, 30));
    
    ctx.fillStyle = hullGradient;
    ctx.fill();
    
    // Add hull edge outline for definition
    ctx.strokeStyle = darkenColor(paddle.shipHullColor, 40);
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Draw central flight deck (top side of the ship)
    ctx.beginPath();
    ctx.moveTo(-shipWidth*0.25, -shipHeight*0.3);
    ctx.lineTo(-shipWidth*0.15, -shipHeight*0.4);
    ctx.lineTo(shipWidth*0.15, -shipHeight*0.4);
    ctx.lineTo(shipWidth*0.25, -shipHeight*0.3);
    ctx.lineTo(shipWidth*0.25, -shipHeight*0.1);
    ctx.lineTo(-shipWidth*0.25, -shipHeight*0.1);
    ctx.closePath();
    ctx.fillStyle = darkenColor(paddle.shipHullColor, 15);
    ctx.fill();
    ctx.strokeStyle = paddle.borderColor;
    ctx.lineWidth = 0.5;
    ctx.stroke();
    
    // Draw forward windows/sensors
    const windowCount = 5;
    const windowWidth = shipWidth * 0.04;
    const windowSpacing = shipWidth * 0.08;
    const windowY = -shipHeight * 0.35;
    
    for (let i = 0; i < windowCount; i++) {
        const windowX = -windowSpacing * (windowCount-1)/2 + windowSpacing * i;
        ctx.fillStyle = activePowerups.sticky 
            ? '#00FFFF' 
            : `rgba(25, 180, 250, ${0.6 + Math.sin(Date.now()/300 + i) * 0.2})`;
        ctx.beginPath();
        ctx.rect(windowX - windowWidth/2, windowY, windowWidth, windowWidth*1.5);
        ctx.fill();
        
        if (activePowerups.sticky) {
            // Add glow effect for sticky powerup
            const glowGradient = ctx.createRadialGradient(
                windowX, windowY, 0,
                windowX, windowY, windowWidth * 3
            );
            glowGradient.addColorStop(0, 'rgba(0, 255, 255, 0.4)');
            glowGradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(windowX, windowY, windowWidth * 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Draw red accents (Cylon style)
    ctx.fillStyle = paddle.detailColor;
    
    // Draw the scanning red "eye"
    const scanPos = Math.sin(Date.now()/1000) * shipWidth * 0.2;
    ctx.beginPath();
    ctx.ellipse(scanPos, -shipHeight*0.25, shipWidth*0.04, shipHeight*0.02, 0, 0, Math.PI*2);
    ctx.fill();
    
    // Add scan glow
    const scanGlow = ctx.createRadialGradient(
        scanPos, -shipHeight*0.25, 0,
        scanPos, -shipHeight*0.25, shipWidth*0.12
    );
    scanGlow.addColorStop(0, 'rgba(255, 0, 0, 0.6)');
    scanGlow.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = scanGlow;
    ctx.beginPath();
    ctx.arc(scanPos, -shipHeight*0.25, shipWidth*0.12, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw engine section
    // Main Engines
    const engineWidth = shipWidth * 0.15;
    const enginePositions = [
        [-shipWidth*0.25, shipHeight*0.25],
        [0, shipHeight*0.28],
        [shipWidth*0.25, shipHeight*0.25]
    ];
    
    // Draw each engine
    enginePositions.forEach((pos, i) => {
        // Engine housing
        ctx.fillStyle = darkenColor(paddle.armorPlatingColor, 10);
        ctx.beginPath();
        ctx.rect(pos[0] - engineWidth/2, pos[1] - engineWidth*0.3, engineWidth, engineWidth * 0.6);
        ctx.fill();
        ctx.strokeStyle = paddle.borderColor;
        ctx.lineWidth = 0.5;
        ctx.stroke();
        
        // Engine exhaust port
        ctx.beginPath();
        ctx.ellipse(pos[0], pos[1], engineWidth*0.4, engineWidth*0.2, 0, 0, Math.PI*2);
        ctx.fillStyle = '#331111';
        ctx.fill();
        
        // Engine glow
        let glowIntensity = engineGlowIntensity;
        
        // Increase glow on thrusters when moving
        if (paddle.isMoving) {
            if ((paddle.thrusters.left && pos[0] < 0) || 
                (paddle.thrusters.right && pos[0] > 0)) {
                glowIntensity += 0.3;
            }
        }
        
        const engineGlow = ctx.createRadialGradient(
            pos[0], pos[1], 0,
            pos[0], pos[1], engineWidth
        );
        engineGlow.addColorStop(0, `rgba(50, 200, 255, ${glowIntensity})`);
        engineGlow.addColorStop(0.6, `rgba(20, 100, 255, ${glowIntensity * 0.6})`);
        engineGlow.addColorStop(1, 'rgba(0, 50, 255, 0)');
        
        ctx.fillStyle = engineGlow;
        ctx.beginPath();
        ctx.ellipse(pos[0], pos[1], engineWidth*0.75, engineWidth*0.4, 0, 0, Math.PI*2);
        ctx.fill();
    });
    
    // Draw armor plating details
    const armorSections = [
        // Left side armor plates
        [-shipWidth*0.4, -shipHeight*0.2, shipWidth*0.1, shipHeight*0.3],
        [-shipWidth*0.3, -shipHeight*0.35, shipWidth*0.1, shipHeight*0.15],
        [-shipWidth*0.38, shipHeight*0.1, shipWidth*0.1, shipHeight*0.15],
        
        // Right side armor plates
        [shipWidth*0.3, -shipHeight*0.2, shipWidth*0.1, shipHeight*0.3],
        [shipWidth*0.2, -shipHeight*0.35, shipWidth*0.1, shipHeight*0.15],
        [shipWidth*0.28, shipHeight*0.1, shipWidth*0.1, shipHeight*0.15]
    ];
    
    armorSections.forEach(section => {
        ctx.fillStyle = paddle.armorPlatingColor;
        ctx.beginPath();
        ctx.rect(section[0], section[1], section[2], section[3]);
        ctx.fill();
        ctx.strokeStyle = darkenColor(paddle.armorPlatingColor, 40);
        ctx.lineWidth = 0.5;
        ctx.stroke();
        
        // Add rivets/panel details
        ctx.fillStyle = lightenColor(paddle.armorPlatingColor, 20);
        const rivetSize = section[2] * 0.1;
        for (let rx = 0; rx < 3; rx++) {
            for (let ry = 0; ry < 4; ry++) {
                if ((rx + ry) % 2 === 0) {
                    const rivetX = section[0] + section[2] * 0.25 + rx * section[2] * 0.25;
                    const rivetY = section[1] + section[3] * 0.2 + ry * section[3] * 0.2;
                    ctx.beginPath();
                    ctx.arc(rivetX, rivetY, rivetSize, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    });
    
    // Add more detail to the wide version when powerup is active
    if (activePowerups.wide) {
        // Additional wing sections for wider ship
        const wingExtensions = [
            // Left extended section
            [-shipWidth*0.9, -shipHeight*0.1, shipWidth*0.4, shipHeight*0.3],
            // Right extended section
            [shipWidth*0.5, -shipHeight*0.1, shipWidth*0.4, shipHeight*0.3]
        ];
        
        wingExtensions.forEach(wing => {
            // Draw wing silhouette
            ctx.beginPath();
            ctx.moveTo(wing[0], wing[1]);
            ctx.lineTo(wing[0] + wing[2] * 0.3, wing[1] - wing[3] * 0.4);
            ctx.lineTo(wing[0] + wing[2], wing[1]);
            ctx.lineTo(wing[0] + wing[2] * 0.8, wing[1] + wing[3]);
            ctx.lineTo(wing[0] + wing[2] * 0.2, wing[1] + wing[3]);
            ctx.closePath();
            
            // Create wing gradient
            const wingGradient = ctx.createLinearGradient(
                wing[0], wing[1], 
                wing[0] + wing[2], wing[1] + wing[3]
            );
            wingGradient.addColorStop(0, paddle.shipHullColor);
            wingGradient.addColorStop(0.5, lightenColor(paddle.shipHullColor, 10));
            wingGradient.addColorStop(1, darkenColor(paddle.shipHullColor, 20));
            
            ctx.fillStyle = wingGradient;
            ctx.fill();
            ctx.strokeStyle = darkenColor(paddle.shipHullColor, 30);
            ctx.lineWidth = 0.5;
            ctx.stroke();
            
            // Add red accent strips on wings
            ctx.fillStyle = paddle.detailColor;
            ctx.beginPath();
            ctx.rect(
                wing[0] + wing[2] * 0.2, 
                wing[1] + wing[3] * 0.3,
                wing[2] * 0.6,
                wing[3] * 0.1
            );
            ctx.fill();
            
            // Add extra engine on wing
            const wingEngineX = wing[0] + wing[2] * 0.5;
            const wingEngineY = wing[1] + wing[3] * 0.8;
            
            // Engine housing
            ctx.fillStyle = darkenColor(paddle.armorPlatingColor, 20);
            ctx.beginPath();
            ctx.rect(
                wingEngineX - engineWidth * 0.4, 
                wingEngineY - engineWidth * 0.3,
                engineWidth * 0.8,
                engineWidth * 0.6
            );
            ctx.fill();
            ctx.strokeStyle = paddle.borderColor;
            ctx.lineWidth = 0.5;
            ctx.stroke();
            
            // Engine exhaust port
            ctx.beginPath();
            ctx.ellipse(
                wingEngineX, 
                wingEngineY, 
                engineWidth * 0.3, 
                engineWidth * 0.15, 
                0, 0, Math.PI * 2
            );
            ctx.fillStyle = '#331111';
            ctx.fill();
            
            // Engine glow
            const wingEngineGlow = ctx.createRadialGradient(
                wingEngineX, wingEngineY, 0,
                wingEngineX, wingEngineY, engineWidth
            );
            wingEngineGlow.addColorStop(0, `rgba(50, 200, 255, ${engineGlowIntensity})`);
            wingEngineGlow.addColorStop(0.6, `rgba(20, 100, 255, ${engineGlowIntensity * 0.6})`);
            wingEngineGlow.addColorStop(1, 'rgba(0, 50, 255, 0)');
            
            ctx.fillStyle = wingEngineGlow;
            ctx.beginPath();
            ctx.ellipse(
                wingEngineX, 
                wingEngineY, 
                engineWidth * 0.7, 
                engineWidth * 0.3, 
                0, 0, Math.PI * 2
            );
            ctx.fill();
        });
    }
    
    // Draw bullet launchers if shoot powerup is active
    if (activePowerups.shoot) {
        const gunPositions = [
            [-shipWidth * 0.3, -shipHeight * 0.3],
            [shipWidth * 0.3, -shipHeight * 0.3]
        ];
        
        gunPositions.forEach(pos => {
            // Gun mount
            ctx.fillStyle = darkenColor(paddle.armorPlatingColor, 30);
            ctx.beginPath();
            ctx.rect(pos[0] - shipWidth * 0.05, pos[1], shipWidth * 0.1, shipHeight * 0.2);
            ctx.fill();
            
            // Gun barrel
            ctx.fillStyle = '#333333';
            ctx.beginPath();
            ctx.rect(pos[0] - shipWidth * 0.02, pos[1] - shipHeight * 0.1, shipWidth * 0.04, shipHeight * 0.1);
            ctx.fill();
            
            // Barrel glow (ready to fire)
            const barrelGlow = ctx.createRadialGradient(
                pos[0], pos[1] - shipHeight * 0.1, 0,
                pos[0], pos[1] - shipHeight * 0.1, shipWidth * 0.08
            );
            
            const pulseRate = Date.now() % 1000 / 1000;
            const glowOpacity = 0.3 + pulseRate * 0.4;
            
            barrelGlow.addColorStop(0, `rgba(255, 255, 0, ${glowOpacity})`);
            barrelGlow.addColorStop(1, 'rgba(255, 255, 0, 0)');
            
            ctx.fillStyle = barrelGlow;
            ctx.beginPath();
            ctx.arc(pos[0], pos[1] - shipHeight * 0.1, shipWidth * 0.08, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    
    // Restore context
    ctx.restore();
}

function drawBricks() {
    const currentTime = Date.now();
    
    for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
            const brick = bricks[c][r];
            if (brick.status === 1) {
                const brickX = c * (brickWidth + brickPadding) + brickOffsetLeft;
                const brickY = r * (brickHeight + brickPadding) + brickOffsetTop;
                brick.x = brickX;
                brick.y = brickY;
                
                // Calculate pulsing glow effect
                const pulseFactor = 0.1 * Math.sin(currentTime / 500 + brick.pulseOffset);
                const currentGlow = brick.glowIntensity + pulseFactor;
                
                // Main brick body (3D perspective) with gradient
                const gradient = ctx.createLinearGradient(brickX, brickY, brickX, brickY + brickHeight);
                gradient.addColorStop(0, brick.color);
                gradient.addColorStop(1, darkenColor(brick.color, 30));
                
                // Draw main brick body with gradient
                ctx.beginPath();
                // Draw a slight trapezoid for 3D effect
                ctx.moveTo(brickX + 2, brickY);
                ctx.lineTo(brickX + brickWidth - 2, brickY);
                ctx.lineTo(brickX + brickWidth, brickY + brickHeight);
                ctx.lineTo(brickX, brickY + brickHeight);
                ctx.closePath();
                ctx.fillStyle = gradient;
                ctx.fill();
                
                // Draw the sci-fi patterns
                if (brick.pattern === 'circuit') {
                    drawCircuitPattern(brickX, brickY, brickWidth, brickHeight, brick.color);
                } else {
                    drawGridPattern(brickX, brickY, brickWidth, brickHeight, brick.color);
                }
                
                // Add top edge highlight (edge facing light)
                ctx.beginPath();
                ctx.moveTo(brickX, brickY);
                ctx.lineTo(brickX + brickWidth, brickY);
                ctx.lineWidth = 2;
                ctx.strokeStyle = lightenColor(brick.color, 40);
                ctx.stroke();
                ctx.closePath();
                
                // Add bottom edge shadow
                ctx.beginPath();
                ctx.moveTo(brickX, brickY + brickHeight);
                ctx.lineTo(brickX + brickWidth, brickY + brickHeight);
                ctx.lineWidth = 2;
                ctx.strokeStyle = darkenColor(brick.color, 40);
                ctx.stroke();
                ctx.closePath();
                
                // Add left/right edges for 3D effect
                ctx.beginPath();
                ctx.moveTo(brickX, brickY);
                ctx.lineTo(brickX, brickY + brickHeight);
                ctx.lineWidth = 1;
                ctx.strokeStyle = darkenColor(brick.color, 20);
                ctx.stroke();
                ctx.closePath();
                
                ctx.beginPath();
                ctx.moveTo(brickX + brickWidth, brickY);
                ctx.lineTo(brickX + brickWidth, brickY + brickHeight);
                ctx.lineWidth = 1;
                ctx.strokeStyle = darkenColor(brick.color, 30);
                ctx.stroke();
                ctx.closePath();
                
                // Add external glow for sci-fi effect
                ctx.beginPath();
                ctx.rect(brickX - 1, brickY - 1, brickWidth + 2, brickHeight + 2);
                ctx.lineWidth = 2;
                ctx.strokeStyle = `rgba(${getColorComponents(brick.color)}, ${currentGlow})`;
                ctx.stroke();
                ctx.closePath();
            }
        }
    }
}

// Draw a circuit-like pattern on the brick
function drawCircuitPattern(x, y, width, height, color) {
    const brightColor = lightenColor(color, 60);
    ctx.strokeStyle = `rgba(${getColorComponents(brightColor)}, 0.4)`;
    ctx.lineWidth = 0.5;
    
    // Horizontal lines
    for (let i = 0; i < 3; i++) {
        const lineY = y + 5 + i * 5;
        ctx.beginPath();
        ctx.moveTo(x + 5, lineY);
        ctx.lineTo(x + width - 5, lineY);
        ctx.stroke();
        ctx.closePath();
    }
    
    // Vertical lines and nodes
    for (let i = 0; i < 5; i++) {
        const lineX = x + 10 + i * 15;
        if (i % 2 === 0) {
            // Full vertical line
            ctx.beginPath();
            ctx.moveTo(lineX, y + 5);
            ctx.lineTo(lineX, y + height - 5);
            ctx.stroke();
            ctx.closePath();
            
            // Circuit node
            ctx.beginPath();
            ctx.arc(lineX, y + 10, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = brightColor;
            ctx.fill();
            ctx.closePath();
        } else {
            // Partial vertical line
            ctx.beginPath();
            ctx.moveTo(lineX, y + 5);
            ctx.lineTo(lineX, y + 10);
            ctx.stroke();
            ctx.closePath();
            
            ctx.beginPath();
            ctx.moveTo(lineX, y + height - 10);
            ctx.lineTo(lineX, y + height - 5);
            ctx.stroke();
            ctx.closePath();
        }
    }
}

// Draw a grid pattern on the brick
function drawGridPattern(x, y, width, height, color) {
    const brightColor = lightenColor(color, 60);
    ctx.strokeStyle = `rgba(${getColorComponents(brightColor)}, 0.3)`;
    ctx.lineWidth = 0.5;
    
    // Vertical lines
    for (let i = 0; i <= 8; i++) {
        const lineX = x + (width / 8) * i;
        ctx.beginPath();
        ctx.moveTo(lineX, y);
        ctx.lineTo(lineX, y + height);
        ctx.stroke();
        ctx.closePath();
    }
    
    // Horizontal lines
    for (let i = 0; i <= 3; i++) {
        const lineY = y + (height / 3) * i;
        ctx.beginPath();
        ctx.moveTo(x, lineY);
        ctx.lineTo(x + width, lineY);
        ctx.stroke();
        ctx.closePath();
    }
}

// Helper function to get RGB components from color for use in rgba()
function getColorComponents(color) {
    let r, g, b;
    
    if (color.startsWith('#')) {
        r = parseInt(color.substr(1, 2), 16);
        g = parseInt(color.substr(3, 2), 16);
        b = parseInt(color.substr(5, 2), 16);
    } else if (color.startsWith('rgb')) {
        const rgbValues = color.match(/\d+/g);
        r = parseInt(rgbValues[0]);
        g = parseInt(rgbValues[1]);
        b = parseInt(rgbValues[2]);
    } else {
        return '255, 255, 255'; // Default to white if color format not recognized
    }
    
    return `${r}, ${g}, ${b}`;
}

function drawScore() {
    scoreElement.textContent = score;
}

function drawLives() {
    livesElement.textContent = lives;
}

function showMessage(msg) {
    ctx.font = '30px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(msg, canvas.width / 2, canvas.height / 2);
    ctx.font = '20px Arial';
    ctx.fillText('Click to continue', canvas.width / 2, canvas.height / 2 + 40);
}

// Move ball and handle collisions
function moveBall() {
    // If ball is stuck to paddle due to sticky powerup
    if (ballStuckToPaddle) {
        ball.x = paddle.x + ballStuckOffset;
        ball.y = paddle.y - ball.radius;
        return;
    }
    
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Wall collision (right/left)
    if (ball.x + ball.radius > canvas.width || ball.x - ball.radius < 0) {
        ball.dx = -ball.dx;
    }

    // Wall collision (top)
    if (ball.y - ball.radius < 0) {
        ball.dy = -ball.dy;
    }

    // Paddle collision
    if (
        ball.y + ball.radius > paddle.y &&
        ball.y + ball.radius < paddle.y + paddle.height &&
        ball.x > paddle.x &&
        ball.x < paddle.x + paddle.width
    ) {
        // Check if sticky powerup is active
        if (activePowerups.sticky) {
            ballStuckToPaddle = true;
            ballStuckOffset = ball.x - paddle.x; // Remember where on the paddle the ball hit
        } else {
            ball.dy = -ball.dy;
            
            // Add some angle based on where ball hits the paddle
            const hitPoint = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
            
            // Add paddle momentum to ball's horizontal velocity
            // The paddle's velocity affects the ball's horizontal direction
            const momentumTransfer = paddle.velocity * 0.7; // 70% of paddle's momentum transfers to ball
            
            // Combine position-based angle with momentum transfer
            ball.dx = hitPoint * 5 + momentumTransfer;
        }
    }

    // Bottom collision (lose life)
    if (ball.y + ball.radius > canvas.height) {
        lives--;
        livesElement.textContent = lives;
        
        if (lives === 0) {
            showMessage('GAME OVER');
            gameOver = true;
            gameStarted = false;
        } else {
            resetBallAndPaddle();
            gameStarted = false;
            showMessage('LIFE LOST! Click to continue');
        }
    }
}

// Move paddle
function movePaddle() {
    if (keys.right) {
        paddle.velocity += paddle.acceleration;
    } else if (keys.left) {
        paddle.velocity -= paddle.acceleration;
    } else {
        paddle.velocity *= paddle.friction;
    }

    if (paddle.velocity > paddle.maxVelocity) {
        paddle.velocity = paddle.maxVelocity;
    } else if (paddle.velocity < -paddle.maxVelocity) {
        paddle.velocity = -paddle.maxVelocity;
    }

    paddle.x += paddle.velocity;

    if (paddle.x < 0) {
        paddle.x = 0;
        paddle.velocity = 0;
    } else if (paddle.x + paddle.width > canvas.width) {
        paddle.x = canvas.width - paddle.width;
        paddle.velocity = 0;
    }
}

// Reset ball and paddle
function resetBallAndPaddle() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height - 50;
    ball.dx = 5;
    ball.dy = -5;
    paddle.x = (canvas.width - paddle.width) / 2;
    
    // Reset ball stuck state
    ballStuckToPaddle = false;
}

// Reset game (for level advancement)
function resetGame(nextLevel = false) {
    if (nextLevel) {
        level++;
        score = 0;
        ball.speed += 0.5;
    }

    resetBallAndPaddle();
    
    // Reset all bricks
    for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
            bricks[c][r] = {
                x: 0,
                y: 0,
                status: 1,
                color: colors[r % colors.length],
                pattern: Math.random() < 0.5 ? 'circuit' : 'grid',
                pulseOffset: Math.random() * Math.PI * 2, // Random offset for pulsing effect
                glowIntensity: 0.4 + Math.random() * 0.2 // Random base glow
            };
        }
    }
    
    // Clear all active powerups
    deactivateAllPowerups();
    
    // Clear all powerups and bullets on screen
    powerups.length = 0;
    bullets.length = 0;
    
    // If we're transitioning to a new level, the animations
    // will handle starting the game and drawing the screen
    if (!levelTransitioning) {
        gameStarted = false;
        draw();
        
        if (nextLevel) {
            showMessage(`LEVEL ${level}! Click to start`);
        }
    }
}

function deactivateAllPowerups() {
    // Clear all timeouts
    if (powerupTimers.wide) clearTimeout(powerupTimers.wide);
    if (powerupTimers.shoot) clearTimeout(powerupTimers.shoot);
    if (powerupTimers.speed) clearTimeout(powerupTimers.speed);
    if (powerupTimers.sticky) clearTimeout(powerupTimers.sticky);
    
    // Reset all powerup states
    activePowerups.wide = false;
    activePowerups.shoot = false;
    activePowerups.speed = false;
    activePowerups.sticky = false;
    
    // Reset paddle properties
    paddle.width = originalPaddleWidth;
    paddle.maxVelocity = originalMaxVelocity;
    
    // Reset ball stuck state
    ballStuckToPaddle = false;
}

// Main draw function
function draw() {
    if (gameOver || !gameStarted || gamePaused) {
        return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw elements
    drawBricks();
    drawBall();
    drawPaddle();
    drawPowerups();
    if (activePowerups.shoot) {
        drawBullets();
    }
    drawScore();
    drawLives();
    
    // Draw active powerup indicators
    drawPowerupIndicators();
    
    // Collision detection
    collisionDetection();
    
    // Move objects
    moveBall();
    movePaddle();
    movePowerups();
    if (activePowerups.shoot) {
        moveBullets();
    }
    
    // Continue animation
    requestAnimationFrame(draw);
}

// Draw powerup indicators
function drawPowerupIndicators() {
    let y = 60;
    const activeIndicators = [];
    
    if (activePowerups.wide) activeIndicators.push({ color: '#FF0000', text: 'WIDE' });
    if (activePowerups.shoot) activeIndicators.push({ color: '#FFFF00', text: 'SHOOT' });
    if (activePowerups.speed) activeIndicators.push({ color: '#00FF00', text: 'SPEED' });
    if (activePowerups.sticky) activeIndicators.push({ color: '#00FFFF', text: 'STICKY' });
    
    for (const indicator of activeIndicators) {
        ctx.fillStyle = indicator.color;
        ctx.font = '14px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(indicator.text, canvas.width - 10, y);
        y += 20;
    }
}

// Initial draw to show starting screen
function init() {
    // Store original values
    originalPaddleWidth = paddle.width;
    originalMaxVelocity = paddle.maxVelocity;
    
    // Clear canvas and draw background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000022'; // Dark blue space background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw ball and paddle
    drawBall();
    drawPaddle();
    drawScore();
    drawLives();
    
    // Start the brick rotation animation immediately on game load
    brickRotationAnimation.active = true;
    brickRotationAnimation.progress = 0;
    brickRotationAnimation.startTime = Date.now();
    
    // Start the animation loop for the rotating bricks
    requestAnimationFrame(updateInitialBrickAnimation);
}

// Update animation for the initial brick rotation when game loads
function updateInitialBrickAnimation() {
    // Draw the bricks with rotation effect
    drawBricksWithRotation();
    
    // Show title message
    ctx.font = '30px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('ARKANOID CLONE', canvas.width / 2, canvas.height / 2);
    ctx.font = '20px Arial';
    ctx.fillText('Click to Start or Press SPACE', canvas.width / 2, canvas.height / 2 + 40);
    
    // Check if all bricks have finished their animation
    const currentTime = Date.now();
    const lastBrickStartTime = brickRotationAnimation.startTime + 
                              (brickColumnCount * brickRowCount - 1) * brickRotationAnimation.staggerDelay;
    const lastBrickFinishTime = lastBrickStartTime + 500; // Each brick takes 500ms to rotate in
    
    if (currentTime < lastBrickFinishTime) {
        // Continue the animation if not all bricks have finished
        requestAnimationFrame(updateInitialBrickAnimation);
    } else {
        // When animation is complete, leave the bricks visible but stop animating
        brickRotationAnimation.active = false;
        
        // Draw the final state of bricks without animation
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000022'; // Dark blue space background
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawBricks();
        drawBall();
        drawPaddle();
        drawScore();
        drawLives();
        
        // Show game title again after final draw
        ctx.font = '30px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText('ARKANOID CLONE', canvas.width / 2, canvas.height / 2);
        ctx.font = '20px Arial';
        ctx.fillText('Click to Start or Press SPACE', canvas.width / 2, canvas.height / 2 + 40);
    }
}

// Draw spaceship hallway transition animation
function drawSpaceshipHallway() {
    const progress = hallwayAnimation.progress;
    
    // Clear screen
    ctx.fillStyle = '#000022'; // Dark blue space background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Calculate dimensions based on animation progress
    const perspectiveScale = 15 * progress;
    const hallwayWidth = canvas.width;
    const hallwayHeight = canvas.height;
    
    // Draw the hallway walls with decreasing size to create perspective
    const segments = 20;
    for (let i = 0; i <= segments; i++) {
        const depth = i / segments;
        const z = depth * perspectiveScale;
        
        // Calculate width and height of this segment
        const segWidth = hallwayWidth * (1 - depth * 0.9);
        const segHeight = hallwayHeight * (1 - depth * 0.9);
        
        // Calculate position
        const x = (canvas.width - segWidth) / 2;
        const y = (canvas.height - segHeight) / 2;
        
        // Draw walls with gradient from current segment to next segment
        const gradientTop = ctx.createLinearGradient(0, y, 0, y + 10);
        const gradientBottom = ctx.createLinearGradient(0, y + segHeight - 10, 0, y + segHeight);
        const gradientLeft = ctx.createLinearGradient(x, 0, x + 10, 0);
        const gradientRight = ctx.createLinearGradient(x + segWidth - 10, 0, x + segWidth, 0);
        
        // Alternating panel colors for more sci-fi feel
        const color1 = i % 2 === 0 ? '#0088FF' : '#0066DD'; // Light and darker blue
        const color2 = i % 2 === 0 ? '#003366' : '#002244'; // Dark blues
        
        [gradientTop, gradientBottom, gradientLeft, gradientRight].forEach(gradient => {
            gradient.addColorStop(0, color1);
            gradient.addColorStop(1, color2);
        });
        
        // Top wall
        ctx.fillStyle = gradientTop;
        ctx.fillRect(x, y, segWidth, 10);
        
        // Bottom wall
        ctx.fillStyle = gradientBottom;
        ctx.fillRect(x, y + segHeight - 10, segWidth, 10);
        
        // Left wall
        ctx.fillStyle = gradientLeft;
        ctx.fillRect(x, y, 10, segHeight);
        
        // Right wall
        ctx.fillStyle = gradientRight;
        ctx.fillRect(x + segWidth - 10, y, 10, segHeight);
        
        // Add tech details every 3 segments
        if (i % 3 === 0 && i < segments - 2) {
            // Draw "tech" panels on walls
            ctx.fillStyle = '#00FFFF';
            
            // Tech panels on sides
            const panelSize = 6 - (depth * 4);
            if (panelSize > 0) {
                const panelCount = 4;
                const panelSpacing = segHeight / (panelCount + 1);
                
                for (let p = 1; p <= panelCount; p++) {
                    // Left wall tech panels
                    ctx.fillRect(x + 3, y + p * panelSpacing, panelSize, panelSize);
                    
                    // Right wall tech panels
                    ctx.fillRect(x + segWidth - 3 - panelSize, y + p * panelSpacing, panelSize, panelSize);
                    
                    // Add blinking lights (only some panels)
                    if ((i + p) % 3 === 0) {
                        const blinkState = Math.floor(Date.now() / 300) % 2;
                        if (blinkState === 0) {
                            ctx.fillStyle = '#FF3366'; // Red warning light
                        } else {
                            ctx.fillStyle = '#FFFF00'; // Yellow warning light
                        }
                        
                        // Smaller blinking light inside panel
                        ctx.fillRect(x + 4, y + p * panelSpacing + 1, panelSize - 2, panelSize - 2);
                        ctx.fillRect(x + segWidth - 4 - panelSize + 2, y + p * panelSpacing + 1, panelSize - 2, panelSize - 2);
                        ctx.fillStyle = '#00FFFF';
                    }
                }
            }
        }
        
        // Add lights on ceiling and floor
        if (i % 2 === 0 && i < segments - 3) {
            const lightSize = 15 - (depth * 12);
            if (lightSize > 0) {
                // Ceiling lights
                const glow = ctx.createRadialGradient(
                    canvas.width / 2, y + 5, 0,
                    canvas.width / 2, y + 5, lightSize * 2
                );
                glow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
                glow.addColorStop(0.5, 'rgba(100, 200, 255, 0.5)');
                glow.addColorStop(1, 'rgba(0, 128, 255, 0)');
                
                ctx.fillStyle = glow;
                ctx.fillRect(canvas.width / 2 - lightSize * 2, y, lightSize * 4, 10);
            }
        }
    }
    
    // Draw player as a small ship at the end of hallway
    const shipSize = 20 + (80 * progress); // Ship grows as we move through hallway
    
    // Save context to apply rotation
    ctx.save();
    
    // Translate to center of ship position
    ctx.translate(canvas.width / 2, canvas.height / 2);
    
    // Create ship body
    ctx.fillStyle = '#DDDDDD';
    ctx.beginPath();
    ctx.moveTo(0, -shipSize/2);
    ctx.lineTo(shipSize/2, shipSize/2);
    ctx.lineTo(-shipSize/2, shipSize/2);
    ctx.closePath();
    ctx.fill();
    
    // Add ship details
    ctx.fillStyle = '#CC0000';
    ctx.fillRect(-shipSize/4, shipSize/4, shipSize/2, shipSize/8);
    
    // Add ship engine glow
    const engineGlow = ctx.createRadialGradient(
        0, shipSize/2, 0,
        0, shipSize/2, shipSize/2
    );
    engineGlow.addColorStop(0, 'rgba(255, 200, 50, 0.9)');
    engineGlow.addColorStop(0.4, 'rgba(255, 100, 50, 0.7)');
    engineGlow.addColorStop(1, 'rgba(255, 50, 0, 0)');
    
    ctx.fillStyle = engineGlow;
    ctx.beginPath();
    ctx.arc(0, shipSize/2, shipSize/3, 0, Math.PI * 2);
    ctx.fill();
    
    // Restore context
    ctx.restore();
    
    // Add speed lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < 30; i++) {
        const length = 20 + Math.random() * 100;
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const angle = Math.atan2(y - canvas.height/2, x - canvas.width/2);
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(
            x - Math.cos(angle) * length * progress,
            y - Math.sin(angle) * length * progress
        );
        ctx.stroke();
    }
    
    // Show level text
    if (progress > 0.5) {
        ctx.font = 'bold 36px Arial';
        ctx.fillStyle = `rgba(255, 255, 255, ${(progress - 0.5) * 2})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`LEVEL ${level}`, canvas.width / 2, canvas.height / 5);
    }
}

// Update the hallway animation
function updateHallwayAnimation() {
    if (!hallwayAnimation.active) return;
    
    const currentTime = Date.now();
    const elapsed = currentTime - hallwayAnimation.startTime;
    hallwayAnimation.progress = Math.min(1, elapsed / hallwayAnimation.duration);
    
    drawSpaceshipHallway();
    
    if (hallwayAnimation.progress >= 1) {
        hallwayAnimation.active = false;
        brickRotationAnimation.active = true;
        brickRotationAnimation.progress = 0;
        brickRotationAnimation.startTime = Date.now();
    } else {
        requestAnimationFrame(updateHallwayAnimation);
    }
}

// Draw bricks with rotation animation on level start
function drawBricksWithRotation() {
    const currentTime = Date.now();
    
    // Clear the screen first
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw a space background
    ctx.fillStyle = '#000022'; // Dark blue space background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw paddle
    drawPaddle();
    
    // Draw score and lives
    drawScore();
    drawLives();
    
    for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
            const brick = bricks[c][r];
            if (brick.status === 1) {
                // Calculate the brick's position
                const brickX = c * (brickWidth + brickPadding) + brickOffsetLeft;
                const brickY = r * (brickHeight + brickPadding) + brickOffsetTop;
                brick.x = brickX;
                brick.y = brickY;
                
                // Calculate staggered start time for this brick
                const brickDelay = (c * brickRowCount + r) * brickRotationAnimation.staggerDelay;
                const brickProgress = Math.max(0, Math.min(1, (currentTime - brickRotationAnimation.startTime - brickDelay) / 500));
                
                if (brickProgress <= 0) {
                    // Skip if this brick's animation hasn't started yet
                    continue;
                }
                
                // Save context for rotation
                ctx.save();
                
                // Translate to brick center for rotation
                ctx.translate(brickX + brickWidth / 2, brickY + brickHeight / 2);
                
                // Apply rotation effect
                const rotationAngle = (1 - brickProgress) * Math.PI;
                ctx.rotate(rotationAngle);
                
                // Apply scale effect (start small, end at full size)
                const scaleValue = brickProgress;
                ctx.scale(scaleValue, scaleValue);
                
                // Calculate pulsing glow effect
                const pulseFactor = 0.1 * Math.sin(currentTime / 500 + brick.pulseOffset);
                const currentGlow = brick.glowIntensity + pulseFactor;
                
                // Main brick body (3D perspective) with gradient
                const gradient = ctx.createLinearGradient(-brickWidth/2, -brickHeight/2, -brickWidth/2, brickHeight/2);
                gradient.addColorStop(0, brick.color);
                gradient.addColorStop(1, darkenColor(brick.color, 30));
                
                // Draw main brick body with gradient
                ctx.beginPath();
                // Draw a slight trapezoid for 3D effect
                ctx.moveTo(-brickWidth/2 + 2, -brickHeight/2);
                ctx.lineTo(brickWidth/2 - 2, -brickHeight/2);
                ctx.lineTo(brickWidth/2, brickHeight/2);
                ctx.lineTo(-brickWidth/2, brickHeight/2);
                ctx.closePath();
                ctx.fillStyle = gradient;
                ctx.fill();
                
                // Draw the sci-fi patterns
                if (brick.pattern === 'circuit') {
                    drawCircuitPatternCentered(0, 0, brickWidth, brickHeight, brick.color);
                } else {
                    drawGridPatternCentered(0, 0, brickWidth, brickHeight, brick.color);
                }
                
                // Add top edge highlight (edge facing light)
                ctx.beginPath();
                ctx.moveTo(-brickWidth/2, -brickHeight/2);
                ctx.lineTo(brickWidth/2, -brickHeight/2);
                ctx.lineWidth = 2;
                ctx.strokeStyle = lightenColor(brick.color, 40);
                ctx.stroke();
                ctx.closePath();
                
                // Add bottom edge shadow
                ctx.beginPath();
                ctx.moveTo(-brickWidth/2, brickHeight/2);
                ctx.lineTo(brickWidth/2, brickHeight/2);
                ctx.lineWidth = 2;
                ctx.strokeStyle = darkenColor(brick.color, 40);
                ctx.stroke();
                ctx.closePath();
                
                // Add left/right edges for 3D effect
                ctx.beginPath();
                ctx.moveTo(-brickWidth/2, -brickHeight/2);
                ctx.lineTo(-brickWidth/2, brickHeight/2);
                ctx.lineWidth = 1;
                ctx.strokeStyle = darkenColor(brick.color, 20);
                ctx.stroke();
                ctx.closePath();
                
                ctx.beginPath();
                ctx.moveTo(brickWidth/2, -brickHeight/2);
                ctx.lineTo(brickWidth/2, brickHeight/2);
                ctx.lineWidth = 1;
                ctx.strokeStyle = darkenColor(brick.color, 30);
                ctx.stroke();
                ctx.closePath();
                
                // Add external glow for sci-fi effect
                ctx.beginPath();
                ctx.rect(-brickWidth/2 - 1, -brickHeight/2 - 1, brickWidth + 2, brickHeight + 2);
                ctx.lineWidth = 2;
                ctx.strokeStyle = `rgba(${getColorComponents(brick.color)}, ${currentGlow})`;
                ctx.stroke();
                ctx.closePath();
                
                // Restore context after rotation and translation
                ctx.restore();
            }
        }
    }
}

// Draw circuit pattern for rotated bricks (centered version)
function drawCircuitPatternCentered(x, y, width, height, color) {
    const brightColor = lightenColor(color, 60);
    ctx.strokeStyle = `rgba(${getColorComponents(brightColor)}, 0.4)`;
    ctx.lineWidth = 0.5;
    
    const halfWidth = width/2;
    const halfHeight = height/2;
    
    // Horizontal lines
    for (let i = 0; i < 3; i++) {
        const lineY = y - halfHeight + 5 + i * 5;
        ctx.beginPath();
        ctx.moveTo(x - halfWidth + 5, lineY);
        ctx.lineTo(x + halfWidth - 5, lineY);
        ctx.stroke();
        ctx.closePath();
    }
    
    // Vertical lines and nodes
    for (let i = 0; i < 5; i++) {
        const lineX = x - halfWidth + 10 + i * 15;
        if (i % 2 === 0) {
            // Full vertical line
            ctx.beginPath();
            ctx.moveTo(lineX, y - halfHeight + 5);
            ctx.lineTo(lineX, y + halfHeight - 5);
            ctx.stroke();
            ctx.closePath();
            
            // Circuit node
            ctx.beginPath();
            ctx.arc(lineX, y - halfHeight + 10, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = brightColor;
            ctx.fill();
            ctx.closePath();
        } else {
            // Partial vertical line
            ctx.beginPath();
            ctx.moveTo(lineX, y - halfHeight + 5);
            ctx.lineTo(lineX, y - halfHeight + 10);
            ctx.stroke();
            ctx.closePath();
            
            ctx.beginPath();
            ctx.moveTo(lineX, y + halfHeight - 10);
            ctx.lineTo(lineX, y + halfHeight - 5);
            ctx.stroke();
            ctx.closePath();
        }
    }
}

// Draw grid pattern for rotated bricks (centered version)
function drawGridPatternCentered(x, y, width, height, color) {
    const brightColor = lightenColor(color, 60);
    ctx.strokeStyle = `rgba(${getColorComponents(brightColor)}, 0.3)`;
    ctx.lineWidth = 0.5;
    
    const halfWidth = width/2;
    const halfHeight = height/2;
    
    // Vertical lines
    for (let i = 0; i <= 8; i++) {
        const lineX = x - halfWidth + (width / 8) * i;
        ctx.beginPath();
        ctx.moveTo(lineX, y - halfHeight);
        ctx.lineTo(lineX, y + halfHeight);
        ctx.stroke();
        ctx.closePath();
    }
    
    // Horizontal lines
    for (let i = 0; i <= 3; i++) {
        const lineY = y - halfHeight + (height / 3) * i;
        ctx.beginPath();
        ctx.moveTo(x - halfWidth, lineY);
        ctx.lineTo(x + halfWidth, lineY);
        ctx.stroke();
        ctx.closePath();
    }
}

// Update the brick rotation animation
function updateBrickRotationAnimation() {
    if (!brickRotationAnimation.active) return;
    
    const currentTime = Date.now();
    const elapsed = currentTime - brickRotationAnimation.startTime;
    brickRotationAnimation.progress = Math.min(1, elapsed / brickRotationAnimation.duration);
    
    drawBricksWithRotation();
    
    // Check if all bricks have finished their animation
    const lastBrickStartTime = brickRotationAnimation.startTime + 
                              (brickColumnCount * brickRowCount - 1) * brickRotationAnimation.staggerDelay;
    const lastBrickFinishTime = lastBrickStartTime + 500; // Each brick takes 500ms to rotate in
    
    if (currentTime > lastBrickFinishTime) {
        brickRotationAnimation.active = false;
        levelTransitioning = false;
        gameStarted = true;
        draw(); // Start regular game drawing
    } else {
        requestAnimationFrame(updateBrickRotationAnimation);
    }
}

// Last Brick Standing Feature
function activateLastBrickStanding() { 
    // If there's 1 or fewer bricks, don't do anything
    if (activeBrickCount <= 1) return;
    
    // Pick a random brick to keep
    let keepBrickC, keepBrickR;
    let pickedBrick = false;
    
    while (!pickedBrick) {
        keepBrickC = Math.floor(Math.random() * brickColumnCount);
        keepBrickR = Math.floor(Math.random() * brickRowCount);
        
        if (bricks[keepBrickC][keepBrickR].status === 1) {
            pickedBrick = true;
        }
    }
    
    // Create an explosion effect
    createLastBrickExplosion();
    
    // Destroy all other bricks and add to score
    let destroyedCount = 0;
    
    for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
            if (bricks[c][r].status === 1 && !(c === keepBrickC && r === keepBrickR)) {
                bricks[c][r].status = 0;
                destroyedCount++;
                
                // Spawn powerups with a higher chance (50% instead of 30%)
                if (Math.random() < 0.5) {
                    createPowerup(bricks[c][r].x, bricks[c][r].y);
                }
            }
        }
    }
    
    // Add score for the destroyed bricks
    score += destroyedCount * 10;
    scoreElement.textContent = score;
    
    // Make the last remaining brick glow brighter
    bricks[keepBrickC][keepBrickR].glowIntensity = 0.8;
}

// Create explosion effect when Last Brick Standing is activated
function createLastBrickExplosion() {
    // Screen flash effect
    const flashOverlay = document.createElement('div');
    flashOverlay.style.position = 'absolute';
    flashOverlay.style.top = '0';
    flashOverlay.style.left = '0';
    flashOverlay.style.width = '100%';
    flashOverlay.style.height = '100%';
    flashOverlay.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
    flashOverlay.style.zIndex = '1000';
    flashOverlay.style.pointerEvents = 'none'; // Allow click-through
    document.body.appendChild(flashOverlay);
    
    // Remove the flash after a short delay
    setTimeout(() => {
        document.body.removeChild(flashOverlay);
    }, 150);
    
    // Play explosion sound if available
    // if (typeof soundFx !== 'undefined' && soundFx.explosion) {
    //     soundFx.explosion.play();
    // }
}

// Initialize the game
init();