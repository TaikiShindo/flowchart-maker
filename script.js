const canvasContent = document.getElementById('canvas-content');
const nodesContainer = document.getElementById('nodes-container');
const svgCanvas = document.getElementById('svg-canvas');
const propertiesPanel = document.getElementById('properties-panel');
const shapeSelect = document.getElementById('shape-select');
const canvasArea = document.getElementById('canvas-area');

let mode = 'select'; // 'select', 'addNode'
let nodeShapeToAdd = 'rectangle';
let nodes = [];
let connections = [];
let nodeIdCounter = 0;

let selectedNodeId = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

let connectingSource = null;
let tempLine = null;

// Initialize
function init() {
    canvasContent.addEventListener('mousedown', handleCanvasMouseDown);
    canvasContent.addEventListener('mousemove', handleCanvasMouseMove);
    document.addEventListener('mouseup', handleCanvasMouseUp);
    
    // Initial scroll position
    canvasArea.scrollLeft = 1500;
    canvasArea.scrollTop = 1500;

    // Add default node in the center of the visible area
    setTimeout(() => {
        const rect = canvasArea.getBoundingClientRect();
        const startX = canvasArea.scrollLeft + rect.width / 2 - 60;
        const startY = canvasArea.scrollTop + rect.height / 2 - 25;
        addNode(startX, startY, 'rectangle', 'スタート');
    }, 100);
}

function setMode(newMode, shape = 'rectangle') {
    mode = newMode;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    
    if (newMode === 'addNode') {
        nodeShapeToAdd = shape;
        event.currentTarget.classList.add('active');
        canvasContent.style.cursor = 'crosshair';
        clearSelection();
    } else if (newMode === 'select') {
        document.getElementById('btn-select').classList.add('active');
        canvasContent.style.cursor = 'default';
    }
}

function handleCanvasMouseDown(e) {
    if (connectingSource) {
        cancelConnection();
        return;
    }
    if (e.target === canvasContent || e.target === svgCanvas || e.target === nodesContainer) {
        if (mode === 'addNode') {
            const rect = canvasContent.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            addNode(x, y, nodeShapeToAdd, 'テキスト');
            setMode('select'); // revert to select mode
        } else {
            clearSelection();
        }
    }
}

function handleCanvasMouseMove(e) {
    const rect = canvasContent.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging && selectedNodeId) {
        const nodeObj = nodes.find(n => n.id === selectedNodeId);
        if (nodeObj) {
            nodeObj.x = x - dragOffset.x;
            nodeObj.y = y - dragOffset.y;
            updateNodeDOM(nodeObj);
            drawConnections();
        }
    } else if (connectingSource) {
        updateTempLine(x, y);
    }
}

function handleCanvasMouseUp(e) {
    isDragging = false;
}

function updateTempLine(x, y) {
    if (!tempLine) {
        tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempLine.classList.add('temp-connection');
        svgCanvas.appendChild(tempLine);
    }
    const sourceNode = nodes.find(n => n.id === connectingSource);
    if (sourceNode) {
        const sourceCenter = getNodeCenter(sourceNode);
        const d = `M ${sourceCenter.x} ${sourceCenter.y} L ${x} ${y}`;
        tempLine.setAttribute('d', d);
    }
}

function cancelConnection() {
    connectingSource = null;
    if (tempLine) {
        svgCanvas.removeChild(tempLine);
        tempLine = null;
    }
}

function addNode(x, y, shape, text) {
    const id = 'node_' + (nodeIdCounter++);
    const color = '#3b82f6';
    
    const nodeObj = { id, x, y, shape, text, color };
    nodes.push(nodeObj);
    
    const el = document.createElement('div');
    el.id = id;
    el.className = `flow-node shape-${shape}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.backgroundColor = color;
    
    const content = document.createElement('div');
    content.className = 'content';
    content.contentEditable = true;
    content.innerText = text;
    
    // Prevent dragging when editing text
    content.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        if (mode === 'select') {
            selectNode(id);
        }
    });
    content.addEventListener('input', (e) => {
        nodeObj.text = e.target.innerText;
        // Draw connections on next frame to allow DOM to update size
        requestAnimationFrame(drawConnections);
    });
    
    el.appendChild(content);
    
    // Add connection points
    const points = ['top', 'right', 'bottom', 'left'];
    points.forEach(p => {
        const cp = document.createElement('div');
        cp.className = `connect-point cp-${p}`;
        cp.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // prevent dragging node
            if (connectingSource) {
                if (connectingSource !== id) addConnection(connectingSource, id);
                cancelConnection();
            } else {
                connectingSource = id;
                const rect = canvasContent.getBoundingClientRect();
                updateTempLine(e.clientX - rect.left, e.clientY - rect.top);
            }
        });
        el.appendChild(cp);
    });
    
    // Add interactions
    el.addEventListener('mousedown', (e) => {
        if (connectingSource) {
            e.stopPropagation();
            if (connectingSource !== id) addConnection(connectingSource, id);
            cancelConnection();
            return;
        }

        if (mode === 'select') {
            e.stopPropagation();
            selectNode(id);
            isDragging = true;
            dragOffset.x = e.clientX - el.getBoundingClientRect().left;
            dragOffset.y = e.clientY - el.getBoundingClientRect().top;
        }
    });

    el.addEventListener('mouseup', (e) => {
        // Drag end handled by global handleCanvasMouseUp
    });
    
    nodesContainer.appendChild(el);
    selectNode(id);
}

function selectNode(id) {
    clearSelection();
    selectedNodeId = id;
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('selected');
        const nodeObj = nodes.find(n => n.id === id);
        if (nodeObj) {
            propertiesPanel.style.display = 'flex';
            shapeSelect.value = nodeObj.shape;
        }
    }
}

function clearSelection() {
    if (selectedNodeId) {
        const el = document.getElementById(selectedNodeId);
        if (el) el.classList.remove('selected');
    }
    selectedNodeId = null;
    propertiesPanel.style.display = 'none';
}

function updateNodeDOM(nodeObj) {
    const el = document.getElementById(nodeObj.id);
    if (el) {
        el.style.left = `${nodeObj.x}px`;
        el.style.top = `${nodeObj.y}px`;
        el.className = `flow-node shape-${nodeObj.shape} ${selectedNodeId === nodeObj.id ? 'selected' : ''}`;
        el.style.backgroundColor = nodeObj.color;
    }
}

function changeNodeColor(color) {
    if (selectedNodeId) {
        const nodeObj = nodes.find(n => n.id === selectedNodeId);
        nodeObj.color = color;
        updateNodeDOM(nodeObj);
    }
}

function changeNodeShape(shape) {
    if (selectedNodeId) {
        const nodeObj = nodes.find(n => n.id === selectedNodeId);
        nodeObj.shape = shape;
        updateNodeDOM(nodeObj);
        drawConnections();
    }
}

function deleteSelected() {
    if (selectedNodeId) {
        // Remove DOM
        const el = document.getElementById(selectedNodeId);
        if (el) el.remove();
        
        // Remove connections
        connections = connections.filter(c => c.from !== selectedNodeId && c.to !== selectedNodeId);
        
        // Remove node
        nodes = nodes.filter(n => n.id !== selectedNodeId);
        
        clearSelection();
        drawConnections();
    }
}

function clearCanvas() {
    if (confirm('キャンバスをすべてクリアしますか？')) {
        nodes = [];
        connections = [];
        nodesContainer.innerHTML = '';
        drawConnections();
        clearSelection();
        nodeIdCounter = 0;
    }
}

function addConnection(fromId, toId) {
    // Avoid duplicates
    if (!connections.find(c => c.from === fromId && c.to === toId)) {
        connections.push({ from: fromId, to: toId });
        drawConnections();
    }
}

function removeConnection(fromId, toId) {
    connections = connections.filter(c => !(c.from === fromId && c.to === toId));
    drawConnections();
}

function getNodeCenter(nodeObj) {
    const el = document.getElementById(nodeObj.id);
    if (!el) return { x: nodeObj.x + 60, y: nodeObj.y + 25 };
    return {
        x: nodeObj.x + el.offsetWidth / 2,
        y: nodeObj.y + el.offsetHeight / 2
    };
}

function drawConnections() {
    // Clear existing connection paths (except markers)
    const paths = svgCanvas.querySelectorAll('.connection-path');
    paths.forEach(p => p.remove());
    
    connections.forEach(conn => {
        const sourceNode = nodes.find(n => n.id === conn.from);
        const targetNode = nodes.find(n => n.id === conn.to);
        
        if (sourceNode && targetNode) {
            const p1 = getNodeCenter(sourceNode);
            const p2 = getNodeCenter(targetNode);
            
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            const targetEl = document.getElementById(targetNode.id);
            const offset = targetEl ? (Math.min(targetEl.offsetWidth, targetEl.offsetHeight) / 2 + 5) : 30;
            
            if (distance < offset) return;
            
            const ratio = (distance - offset) / distance;
            const endX = p1.x + dx * ratio;
            const endY = p1.y + dy * ratio;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.classList.add('connection-path');
            
            const d = `M ${p1.x} ${p1.y} L ${endX} ${endY}`;
            path.setAttribute('d', d);
            path.setAttribute('marker-end', 'url(#arrowhead)');
            
            path.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('この接続を削除しますか？')) {
                    removeConnection(conn.from, conn.to);
                }
            });
            
            path.addEventListener('mouseover', () => {
                path.setAttribute('marker-end', 'url(#arrowhead-hover)');
            });
            path.addEventListener('mouseout', () => {
                path.setAttribute('marker-end', 'url(#arrowhead)');
            });
            
            svgCanvas.appendChild(path);
        }
    });
}

function exportFlowchart(format = 'png') {
    if (nodes.length === 0) {
        alert('保存するフローチャートがありません。');
        return;
    }
    
    clearSelection();
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
        const el = document.getElementById(n.id);
        const w = el ? el.offsetWidth : 120;
        const h = el ? el.offsetHeight : 50;
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x + w > maxX) maxX = n.x + w;
        if (n.y + h > maxY) maxY = n.y + h;
    });
    
    const padding = 50;
    const exportWidth = maxX - minX + padding * 2;
    const exportHeight = maxY - minY + padding * 2;
    
    // Hide grid background temporarily
    const oldBg = canvasContent.style.backgroundImage;
    canvasContent.style.backgroundImage = 'none';
    canvasContent.style.backgroundColor = '#0f172a';
    
    htmlToImage.toCanvas(canvasContent, {
        width: exportWidth,
        height: exportHeight,
        style: {
            transform: `translate(${-(minX - padding)}px, ${-(minY - padding)}px)`
        }
    }).then(canvas => {
        // Restore background
        canvasContent.style.backgroundImage = oldBg;
        canvasContent.style.backgroundColor = '';
        
        if (format === 'pdf') {
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            const pdf = new window.jspdf.jsPDF({
                orientation: exportWidth > exportHeight ? 'l' : 'p',
                unit: 'px',
                format: [exportWidth, exportHeight]
            });
            pdf.addImage(imgData, 'JPEG', 0, 0, exportWidth, exportHeight);
            pdf.save('flowchart.pdf');
        } else {
            const link = document.createElement('a');
            link.download = `flowchart.${format}`;
            link.href = canvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : format}`);
            link.click();
        }
    }).catch(err => {
        console.error('Export failed:', err);
        alert('書き出しに失敗しました。');
        canvasContent.style.backgroundImage = oldBg;
        canvasContent.style.backgroundColor = '';
    });
}

window.addEventListener('resize', drawConnections);

// Konami code logic
const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiIndex = 0;

window.addEventListener('keydown', (e) => {
    // Hidden game trigger
    if (e.key === konamiCode[konamiIndex] || e.key.toLowerCase() === konamiCode[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konamiCode.length) {
            startHiddenGame();
            konamiIndex = 0;
        }
    } else {
        konamiIndex = 0;
    }
});

function startHiddenGame() {
    if (document.getElementById('hidden-game-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'hidden-game-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.9)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.backdropFilter = 'blur(10px)';
    
    const title = document.createElement('h2');
    title.innerText = '🐍 SECRET SNAKE GAME 🐍';
    title.style.color = '#10b981';
    title.style.marginBottom = '20px';
    title.style.fontFamily = 'monospace';
    title.style.fontSize = '2rem';
    
    const scoreEl = document.createElement('div');
    scoreEl.innerText = 'Score: 0';
    scoreEl.style.color = 'white';
    scoreEl.style.marginBottom = '10px';
    scoreEl.style.fontFamily = 'monospace';
    scoreEl.style.fontSize = '1.5rem';

    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    canvas.style.border = '4px solid #3b82f6';
    canvas.style.borderRadius = '8px';
    canvas.style.backgroundColor = '#000';
    
    const closeBtn = document.createElement('button');
    closeBtn.innerText = 'ゲームを終了する (ESC)';
    closeBtn.style.marginTop = '20px';
    closeBtn.className = 'tool-btn danger';
    
    overlay.appendChild(title);
    overlay.appendChild(scoreEl);
    overlay.appendChild(canvas);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
    
    const ctx = canvas.getContext('2d');
    const gridSize = 20;
    let snake = [{x: 200, y: 200}];
    let food = {x: 100, y: 100};
    let dx = gridSize;
    let dy = 0;
    let score = 0;
    let gameLoop;
    
    function randomFood() {
        food.x = Math.floor(Math.random() * (canvas.width / gridSize)) * gridSize;
        food.y = Math.floor(Math.random() * (canvas.height / gridSize)) * gridSize;
    }
    
    function reset() {
        snake = [{x: 200, y: 200}];
        dx = gridSize; dy = 0; score = 0;
        scoreEl.innerText = 'Score: ' + score;
        randomFood();
    }
    
    function draw() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(food.x, food.y, gridSize, gridSize);
        
        ctx.fillStyle = '#10b981';
        snake.forEach((segment) => {
            ctx.fillRect(segment.x, segment.y, gridSize - 1, gridSize - 1);
        });
        
        const head = {x: snake[0].x + dx, y: snake[0].y + dy};
        
        if (head.x < 0) head.x = canvas.width - gridSize;
        if (head.x >= canvas.width) head.x = 0;
        if (head.y < 0) head.y = canvas.height - gridSize;
        if (head.y >= canvas.height) head.y = 0;
        
        for (let i = 0; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) {
                reset();
                return;
            }
        }
        
        snake.unshift(head);
        
        if (head.x === food.x && head.y === food.y) {
            score += 10;
            scoreEl.innerText = 'Score: ' + score;
            randomFood();
        } else {
            snake.pop();
        }
    }
    
    function handleKeyDown(e) {
        if (e.key === 'Escape') {
            closeGame();
            return;
        }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
        }
        if (e.key === 'ArrowUp' && dy === 0) { dx = 0; dy = -gridSize; }
        if (e.key === 'ArrowDown' && dy === 0) { dx = 0; dy = gridSize; }
        if (e.key === 'ArrowLeft' && dx === 0) { dx = -gridSize; dy = 0; }
        if (e.key === 'ArrowRight' && dx === 0) { dx = gridSize; dy = 0; }
    }
    
    window.addEventListener('keydown', handleKeyDown);
    
    function closeGame() {
        clearInterval(gameLoop);
        window.removeEventListener('keydown', handleKeyDown);
        if (overlay.parentNode) {
            document.body.removeChild(overlay);
        }
    }
    
    closeBtn.onclick = closeGame;
    
    randomFood();
    gameLoop = setInterval(draw, 100);
}

// Start
init();
