document.addEventListener('DOMContentLoaded', () => {
    const desktop = document.getElementById('desktop');
    const taskbarApps = document.getElementById('taskbar-apps');
    const startButton = document.getElementById('start-button');
    const startMenu = document.getElementById('start-menu');
    const clockElement = document.getElementById('clock');
    const windowTemplate = document.getElementById('window-template');

    let activeWindow = null;
    let highestZIndex = 1;
    let openWindows = {}; // To track open windows by app ID and their state

    // --- Clock --- (No change)
    function updateClock() {
        const now = new Date();
        const hours = now.getHours() % 12 || 12;
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
        clockElement.textContent = `${hours}:${minutes} ${ampm}`;
    }
    setInterval(updateClock, 1000);
    updateClock();

    // --- Start Menu --- (No change in basic logic)
    startButton.addEventListener('click', (event) => {
        event.stopPropagation();
        startMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (event) => {
        if (!startMenu.classList.contains('hidden') && !startMenu.contains(event.target) && event.target !== startButton && !startButton.contains(event.target)) {
            startMenu.classList.add('hidden');
        }
    });

    startMenu.addEventListener('click', (event) => {
        const listItem = event.target.closest('li');
        if (listItem && listItem.dataset.app) {
            const appId = listItem.dataset.app;
            createWindowForApp(appId);
            startMenu.classList.add('hidden');
        }
        if (listItem && listItem.id === 'shutdown-btn') {
            alert("It is now safe to turn off your computer. (Just kidding, close the browser tab!)");
            startMenu.classList.add('hidden');
        }
    });

    // --- Desktop Icons --- (No change in basic logic)
    document.querySelectorAll('.desktop-icon').forEach(icon => {
        icon.addEventListener('dblclick', () => {
            const appId = icon.dataset.app;
            createWindowForApp(appId);
        });
    });


    // --- Window Creation and Management ---
    function createWindowForApp(appId) {
        if (openWindows[appId] && !openWindows[appId].element.classList.contains('minimized')) {
            focusWindow(openWindows[appId].element);
            return openWindows[appId].element;
        }
        if (openWindows[appId] && openWindows[appId].element.classList.contains('minimized')) {
            restoreWindow(openWindows[appId].element, openWindows[appId].taskbarButton);
            return openWindows[appId].element;
        }

        const appConfig = getAppConfig(appId);
        if (!appConfig) return;

        const windowEl = windowTemplate.content.cloneNode(true).firstElementChild;
        windowEl.style.width = appConfig.width || '400px';
        windowEl.style.height = appConfig.height || '300px';
        // Ensure windows don't all spawn at the exact same spot
        const offset = Object.keys(openWindows).length * 20;
        const initialX = 50 + offset;
        const initialY = 50 + offset;
        windowEl.style.left = `${Math.min(initialX, desktop.offsetWidth - parseInt(appConfig.width || 400, 10) - 20)}px`;
        windowEl.style.top = `${Math.min(initialY, desktop.offsetHeight - parseInt(appConfig.height || 300, 10) - 40)}px`;


        windowEl.querySelector('.window-title').textContent = appConfig.title;
        const windowIconEl = windowEl.querySelector('.window-icon');
        if (appConfig.icon) {
            windowIconEl.src = appConfig.icon;
            windowIconEl.alt = appConfig.title;
        } else {
            windowIconEl.style.display = 'none';
        }
        const contentArea = windowEl.querySelector('.window-content');
        contentArea.innerHTML = appConfig.content;

        // Make window focusable for keyboard events (especially for games)
        windowEl.setAttribute('tabindex', '-1'); // -1 so it's focusable by script, not by tabbing sequence

        desktop.appendChild(windowEl);
        
        const taskbarButton = createTaskbarButton(appConfig, windowEl);
        taskbarApps.appendChild(taskbarButton);

        // Store window data *before* calling init, so init can access it if needed (e.g., for gameIntervalId)
        openWindows[appId] = { 
            element: windowEl, 
            taskbarButton: taskbarButton, 
            originalState: {}, 
            isMaximized: false 
        };

        makeDraggable(windowEl);
        focusWindow(windowEl); // This now also calls .focus()

        const closeBtn = windowEl.querySelector('.close-btn');
        const minimizeBtn = windowEl.querySelector('.minimize-btn');
        const maximizeBtn = windowEl.querySelector('.maximize-btn');

        closeBtn.addEventListener('click', () => closeWindow(windowEl, taskbarButton, appId));
        minimizeBtn.addEventListener('click', () => minimizeWindow(windowEl, taskbarButton));
        maximizeBtn.addEventListener('click', () => maximizeWindow(windowEl, appId));

        windowEl.addEventListener('mousedown', () => focusWindow(windowEl), true); // Use capture to ensure it fires early

        if (appConfig.init) {
            appConfig.init(windowEl, appId); // Pass appId for potential use in init
        }
        return windowEl;
    }

    function getAppConfig(appId) {
        switch (appId) {
            case 'notepad':
                return {
                    title: 'Untitled - Notepad',
                    icon: 'icons/notepad.svg',
                    width: '500px', height: '400px',
                    content: `<textarea class="notepad-textarea" spellcheck="false"></textarea>`,
                    init: (winEl) => { winEl.querySelector('textarea').focus(); }
                };
            case 'calculator':
                return {
                    title: 'Calculator',
                    icon: 'icons/calculator.svg',
                    width: '240px', height: '320px', // Adjusted for new styles
                    content: `
                        <div class="calculator-app">
                            <div class="calculator-display">0</div>
                            <div class="calculator-buttons">
                                <button data-char="C" class="operator">C</button><button data-char="CE" class="operator">CE</button><button data-char="<-" class="operator">&larr;</button><button data-char="/" class="operator">/</button>
                                <button data-char="7">7</button><button data-char="8">8</button><button data-char="9">9</button><button data-char="*" class="operator">*</button>
                                <button data-char="4">4</button><button data-char="5">5</button><button data-char="6">6</button><button data-char="-" class="operator">-</button>
                                <button data-char="1">1</button><button data-char="2">2</button><button data-char="3">3</button><button data-char="+" class="operator">+</button>
                                <button data-char="0" style="grid-column: span 2;">0</button><button data-char=".">.</button><button data-char="=" class="equals">=</button>
                            </div>
                        </div>`,
                    init: initCalculator
                };
            case 'paint': // No change to config, just icon path
                return {
                    title: 'Untitled - Paint',
                    icon: 'icons/paint.svg',
                    width: '600px', height: '450px',
                    content: `
                        <div class="paint-app">
                            <div class="paint-toolbar">
                                <label for="paintColor">Color:</label>
                                <input type="color" id="paintColor" value="#000000">
                                <label for="lineWidth">Size:</label>
                                <input type="number" id="lineWidth" value="5" min="1" max="50" style="width: 50px;">
                                <button id="clearCanvasBtn">Clear</button>
                            </div>
                            <div class="paint-canvas-container">
                                <canvas id="paintCanvas" width="580" height="350"></canvas>
                            </div>
                        </div>`,
                    init: initPaint
                };
            case 'mediaplayer': // No change to config, just icon path
                return {
                    title: 'Windows Media Player',
                    icon: 'icons/media-player.svg',
                    width: '450px', height: '350px',
                    content: `
                        <div class="mediaplayer-app">
                            <video id="mediaElement" controls></video>
                            <div class="media-controls">
                                <input type="file" id="mediaFile" accept="video/*,audio/*">
                            </div>
                        </div>`,
                    init: initMediaPlayer
                };
            case 'snake': // NEW APP
                return {
                    title: 'Snake Game',
                    icon: 'icons/snake.svg',
                    width: '345px', // Canvas 300 + padding/border + score
                    height: '405px', // Canvas 300 + score display + padding/border + button
                    content: `
                        <div class="snake-game-app">
                            <div class="snake-score">Score: <span id="snakeScoreDisplay">0</span></div>
                            <canvas id="snakeCanvas" width="300" height="300"></canvas>
                            <button id="snakeRestartBtn">Restart Game</button>
                        </div>`,
                    init: initSnake
                };
            default:
                console.warn('Unknown app ID:', appId);
                return null;
        }
    }

    function makeDraggable(element) {
        const titleBar = element.querySelector('.window-title-bar');
        let offsetX, offsetY, isDragging = false;

        titleBar.addEventListener('mousedown', (e) => {
            if (e.target.closest('.window-controls button') || openWindows[element.dataset.appId]?.isMaximized) return;
            isDragging = true;
            offsetX = e.clientX - element.offsetLeft;
            offsetY = e.clientY - element.offsetTop;
            // Apply user-select none to body to prevent text selection issues during drag
            document.body.style.userSelect = 'none';
            focusWindow(element);
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let newX = e.clientX - offsetX;
            let newY = e.clientY - offsetY;
            const taskbarHeight = document.getElementById('taskbar').offsetHeight;
            newX = Math.max(0, Math.min(newX, desktop.offsetWidth - element.offsetWidth));
            newY = Math.max(0, Math.min(newY, desktop.offsetHeight - element.offsetHeight));
            element.style.left = `${newX}px`;
            element.style.top = `${newY}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                // Reset user-select on body
                document.body.style.userSelect = 'auto';
            }
        });
    }

    function focusWindow(windowEl) {
        if (!windowEl) return;

        if (activeWindow && activeWindow !== windowEl) {
            activeWindow.classList.remove('active');
            const activeTaskbarButton = taskbarApps.querySelector(`.taskbar-app-button[data-window-id="${activeWindow.dataset.windowId}"]`);
            if (activeTaskbarButton) activeTaskbarButton.classList.remove('active');
        }
        
        highestZIndex++;
        windowEl.style.zIndex = highestZIndex;
        windowEl.classList.add('active');
        activeWindow = windowEl;

        // Set focus to the window element itself for keyboard events
        // Check if it's not minimized before focusing
        if (!windowEl.classList.contains('minimized')) {
            windowEl.focus();
        }


        const taskbarButton = taskbarApps.querySelector(`.taskbar-app-button[data-window-id="${windowEl.dataset.windowId}"]`);
        if (taskbarButton) {
            taskbarApps.querySelectorAll('.taskbar-app-button').forEach(btn => btn.classList.remove('active'));
            if (!windowEl.classList.contains('minimized')) {
                 taskbarButton.classList.add('active');
            }
        }
    }

    function createTaskbarButton(appConfig, windowEl) {
        const button = document.createElement('button');
        button.className = 'taskbar-app-button';
        const windowId = `win_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        windowEl.dataset.windowId = windowId; // Link window to its button
        windowEl.dataset.appId = appConfig.title.toLowerCase().replace(/\s+/g, '-').split('-')[0]; // Store appId for draggable check
        button.dataset.windowId = windowId;

        const img = document.createElement('img');
        img.src = appConfig.icon || 'icons/xp_icon.svg';
        img.alt = '';
        button.appendChild(img);
        
        const titleText = appConfig.title.length > 18 ? appConfig.title.substring(0, 15) + "..." : appConfig.title;
        button.appendChild(document.createTextNode(titleText));

        button.addEventListener('click', () => {
            if (windowEl.classList.contains('minimized')) {
                restoreWindow(windowEl, button);
            } else if (activeWindow === windowEl) {
                minimizeWindow(windowEl, button);
            } else {
                focusWindow(windowEl);
            }
        });
        return button;
    }

    function closeWindow(windowEl, taskbarButton, appId) {
        // App-specific cleanup
        if (appId === 'snake' && openWindows[appId] && openWindows[appId].gameIntervalId) {
            clearInterval(openWindows[appId].gameIntervalId);
            openWindows[appId].gameIntervalId = null;
             if (openWindows[appId].keyListener) { // Remove key listener
                document.removeEventListener('keydown', openWindows[appId].keyListener);
             }
        }

        desktop.removeChild(windowEl);
        if (taskbarButton) taskbarApps.removeChild(taskbarButton);
        
        if (activeWindow === windowEl) activeWindow = null;
        delete openWindows[appId];

        const remainingWindows = Array.from(desktop.querySelectorAll('.window:not(.minimized)'))
                                   .sort((a,b) => parseInt(b.style.zIndex || 0) - parseInt(a.style.zIndex || 0));
        if (remainingWindows.length > 0) {
            focusWindow(remainingWindows[0]);
        } else {
            activeWindow = null; // Explicitly nullify if no windows left
        }
    }

    function minimizeWindow(windowEl, taskbarButton) {
        if (!windowEl) return;
        const appData = Object.values(openWindows).find(data => data.element === windowEl);
        if (appData) {
             appData.originalState.display = windowEl.style.display;
        }

        windowEl.classList.add('minimized');
        // windowEl.style.display = 'none'; // More explicit hiding than just class
        if (taskbarButton) taskbarButton.classList.remove('active');
        
        if (activeWindow === windowEl) {
            activeWindow = null;
            const allWindows = Array.from(desktop.querySelectorAll('.window:not(.minimized)'))
                                   .sort((a,b) => parseInt(b.style.zIndex || 0) - parseInt(a.style.zIndex || 0));
            if (allWindows.length > 0) focusWindow(allWindows[0]);
        }
    }

    function restoreWindow(windowEl, taskbarButton) {
        if (!windowEl) return;
        // windowEl.style.display = ''; // Restore display
        windowEl.classList.remove('minimized');
        focusWindow(windowEl); // This will also mark taskbar button active and set focus
    }

    function maximizeWindow(windowEl, appId) {
        if (!windowEl || !openWindows[appId]) return;

        const winData = openWindows[appId];
        const taskbarHeight = document.getElementById('taskbar').offsetHeight;
        const desktopWidth = desktop.clientWidth;
        const desktopHeight = desktop.clientHeight; // Use clientHeight of desktop div itself

        const titleBar = windowEl.querySelector('.window-title-bar');

        if (winData.isMaximized) {
            windowEl.style.width = winData.originalState.width;
            windowEl.style.height = winData.originalState.height;
            windowEl.style.top = winData.originalState.top;
            windowEl.style.left = winData.originalState.left;
            titleBar.style.cursor = 'move';
            winData.isMaximized = false;
        } else {
            winData.originalState = {
                width: windowEl.style.width,
                height: windowEl.style.height,
                top: windowEl.style.top,
                left: windowEl.style.left,
            };
            windowEl.style.width = `${desktopWidth}px`;
            windowEl.style.height = `${desktopHeight}px`;
            windowEl.style.top = '0px';
            windowEl.style.left = '0px';
            titleBar.style.cursor = 'default';
            winData.isMaximized = true;
        }
        focusWindow(windowEl);
    }


    // --- Application Specific Initializers ---
    function initCalculator(windowEl) {
        const display = windowEl.querySelector('.calculator-display');
        const buttons = windowEl.querySelectorAll('.calculator-buttons button');
        let currentInput = '0';
        let previousInput = '';
        let operator = null;
        let shouldResetDisplay = false;

        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const char = button.dataset.char;

                if (currentInput === 'Error' && char !== 'C' && char !== 'CE') return;

                if ((char >= '0' && char <= '9') || char === '.') {
                    if (char === '.' && currentInput.includes('.')) return;
                    if (currentInput === '0' && char !== '.' || shouldResetDisplay) {
                        currentInput = char;
                        shouldResetDisplay = false;
                    } else {
                        currentInput += char;
                    }
                    display.textContent = currentInput.slice(0, 15); // Limit display length
                } else if (['/', '*', '-', '+'].includes(char)) {
                    if (operator && previousInput !== '' && currentInput !== '' && !shouldResetDisplay) {
                        calculate();
                        if (currentInput === 'Error') return; // Stop if calculation resulted in error
                    }
                    operator = char;
                    previousInput = currentInput;
                    shouldResetDisplay = true;
                } else if (char === '=') {
                    if (operator && previousInput !== '' && currentInput !== '') {
                        calculate();
                        operator = null;
                        previousInput = ''; // Reset for next independent calculation
                        shouldResetDisplay = true;
                    }
                } else if (char === 'C') {
                    currentInput = '0';
                    previousInput = '';
                    operator = null;
                    shouldResetDisplay = false;
                    display.textContent = currentInput;
                } else if (char === 'CE') {
                    currentInput = '0';
                    shouldResetDisplay = true; // So next number replaces it
                    display.textContent = currentInput;
                } else if (char === '<-') {
                    if (shouldResetDisplay) return; // Don't backspace if display is to be reset
                    currentInput = currentInput.slice(0, -1) || '0';
                    display.textContent = currentInput;
                }
            });
        });

        function calculate() {
            if (!operator || previousInput === '') return;

            const prev = parseFloat(previousInput);
            const curr = parseFloat(currentInput);

            if (isNaN(prev) || isNaN(curr)) {
                currentInput = 'Error';
                operator = null;
                previousInput = '';
                shouldResetDisplay = true;
                display.textContent = currentInput;
                return;
            }

            let result;
            switch (operator) {
                case '+': result = prev + curr; break;
                case '-': result = prev - curr; break;
                case '*': result = prev * curr; break;
                case '/':
                    if (curr === 0) {
                        currentInput = 'Error';
                        operator = null;
                        previousInput = '';
                        shouldResetDisplay = true;
                        display.textContent = currentInput;
                        return;
                    }
                    result = prev / curr;
                    break;
                default: return;
            }
            // Basic handling for floating point precision (e.g. 0.1 + 0.2)
            // This is a simple fix, more robust libraries exist for complex needs
            result = parseFloat(result.toPrecision(12));

            currentInput = result.toString();
            if (currentInput === "NaN" || currentInput === "Infinity" || currentInput === "-Infinity") {
                currentInput = "Error";
            }
            display.textContent = currentInput.slice(0,15);
            // previousInput will be set by the operator handler if chaining, or cleared by '=' handler
        }
    }

    function initPaint(windowEl) { // Minor adjustments for canvas container
        const canvas = windowEl.querySelector('#paintCanvas');
        const ctx = canvas.getContext('2d');
        const colorPicker = windowEl.querySelector('#paintColor');
        const lineWidthInput = windowEl.querySelector('#lineWidth');
        const clearBtn = windowEl.querySelector('#clearCanvasBtn');
        
        // Match canvas to its container initially if you want responsive-like behavior
        // For fixed size as in CSS, this is fine:
        // canvas.width = canvas.offsetWidth;
        // canvas.height = canvas.offsetHeight;

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'black';

        let painting = false;

        function startPosition(e) {
            painting = true;
            draw(e);
        }
        function endPosition() {
            painting = false;
            ctx.beginPath();
        }
        function draw(e) {
            if (!painting) return;
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            ctx.lineWidth = lineWidthInput.value;
            ctx.lineCap = 'round';
            ctx.strokeStyle = colorPicker.value;
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
        }

        canvas.addEventListener('mousedown', startPosition);
        canvas.addEventListener('mouseup', endPosition);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseleave', endPosition);

        clearBtn.addEventListener('click', () => {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = colorPicker.value;
            ctx.beginPath();
        });
    }

    function initMediaPlayer(windowEl) { // No major change
        const mediaElement = windowEl.querySelector('#mediaElement');
        const fileInput = windowEl.querySelector('#mediaFile');

        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                mediaElement.src = url;
                mediaElement.play().catch(e => console.error("Media play error:", e));
                const titleBar = windowEl.querySelector('.window-title');
                if (titleBar) {
                    let fileName = file.name.length > 30 ? file.name.substring(0,27) + "..." : file.name;
                    titleBar.textContent = fileName + " - Media Player";
                }
            }
        });
    }

    // --- SNAKE GAME ---
    function initSnake(windowEl, appId) {
        const canvas = windowEl.querySelector('#snakeCanvas');
        const ctx = canvas.getContext('2d');
        const scoreDisplay = windowEl.querySelector('#snakeScoreDisplay');
        const restartBtn = windowEl.querySelector('#snakeRestartBtn');

        const gridSize = 20; // Size of each grid cell (and snake segment/food)
        const tileCountX = canvas.width / gridSize;
        const tileCountY = canvas.height / gridSize;

        let snake, food, score, direction, gameIntervalId, isGameOver;

        function defaultState() {
            snake = [{ x: Math.floor(tileCountX / 2), y: Math.floor(tileCountY / 2) }]; // Start in middle
            food = { x: 0, y: 0 };
            placeFood();
            score = 0;
            scoreDisplay.textContent = score;
            direction = { x: 0, y: 0 }; // No initial movement until key press
            isGameOver = false;
            if (gameIntervalId) clearInterval(gameIntervalId);
             // Remove old listener before adding a new one for this window instance
            if (openWindows[appId] && openWindows[appId].keyListener) {
                document.removeEventListener('keydown', openWindows[appId].keyListener);
            }
            openWindows[appId].keyListener = handleKeyPress; // Store for removal on close
            document.addEventListener('keydown', handleKeyPress);

        }
        
        function startGameLoop() {
            if (gameIntervalId) clearInterval(gameIntervalId); // Clear any existing loop
            gameIntervalId = setInterval(gameLoop, 120); // Adjust speed as needed
            openWindows[appId].gameIntervalId = gameIntervalId; // Store for cleanup on window close
        }


        function gameLoop() {
            if (isGameOver) {
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'white';
                ctx.font = '30px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2 - 20);
                ctx.font = '20px Arial';
                ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
                ctx.fillText('Press Restart', canvas.width / 2, canvas.height / 2 + 50);
                clearInterval(gameIntervalId);
                return;
            }

            updateSnakePosition();
            checkCollision();
            if (isGameOver) return; // Check again after collision detection

            drawGame();
        }

        function placeFood() {
            food.x = Math.floor(Math.random() * tileCountX);
            food.y = Math.floor(Math.random() * tileCountY);
            // Ensure food doesn't spawn on snake
            for (let segment of snake) {
                if (segment.x === food.x && segment.y === food.y) {
                    placeFood(); // Try again
                    return;
                }
            }
        }

        function updateSnakePosition() {
            if (direction.x === 0 && direction.y === 0) return; // No movement yet

            const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
            snake.unshift(head); // Add new head

            // Check if food eaten
            if (head.x === food.x && head.y === food.y) {
                score++;
                scoreDisplay.textContent = score;
                placeFood();
            } else {
                snake.pop(); // Remove tail if no food eaten
            }
        }

        function checkCollision() {
            const head = snake[0];
            // Wall collision
            if (head.x < 0 || head.x >= tileCountX || head.y < 0 || head.y >= tileCountY) {
                isGameOver = true;
                return;
            }
            // Self collision (check against rest of the body)
            for (let i = 1; i < snake.length; i++) {
                if (head.x === snake[i].x && head.y === snake[i].y) {
                    isGameOver = true;
                    return;
                }
            }
        }

        function drawGame() {
            // Clear canvas (background color)
            ctx.fillStyle = '#C2E2C2'; // Snake game background
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw food
            ctx.fillStyle = '#FF4500'; // OrangeRed for food
            ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize -1, gridSize -1); // -1 for slight gap

            // Draw snake
            ctx.fillStyle = '#38761D'; // Darker green for snake
            snake.forEach(segment => {
                ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize -1, gridSize -1);
            });
        }

        function handleKeyPress(e) {
            // Only respond if this snake game window is active
            if (activeWindow !== windowEl || isGameOver && e.key !== "Enter" && e.key !== " ") return;

            // Start game on first key press if no direction set
            if (direction.x === 0 && direction.y === 0 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                 startGameLoop(); // Start the game loop on first valid move
            }

            switch (e.key) {
                case 'ArrowUp':
                    if (direction.y === 0) direction = { x: 0, y: -1 }; // Prevent 180 turn
                    break;
                case 'ArrowDown':
                    if (direction.y === 0) direction = { x: 0, y: 1 };
                    break;
                case 'ArrowLeft':
                    if (direction.x === 0) direction = { x: -1, y: 0 };
                    break;
                case 'ArrowRight':
                    if (direction.x === 0) direction = { x: 1, y: 0 };
                    break;
            }
            // Prevent page scroll with arrow keys
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }
        }
        
        restartBtn.addEventListener('click', () => {
            defaultState();
            startGameLoop(); // Start a new game loop
            drawGame(); // Initial draw
            windowEl.focus(); // Ensure window has focus for key events
        });

        // Initial setup
        defaultState();
        drawGame(); // Draw initial state (snake and food, no movement)
        windowEl.focus(); // Focus on window creation
    }

});