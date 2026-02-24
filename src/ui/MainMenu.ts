export class MainMenu {
  private container: HTMLDivElement;
  private onStart: () => void;

  constructor(onStart: () => void) {
    this.onStart = onStart;

    this.container = document.createElement('div');
    this.container.id = 'main-menu';
    this.container.innerHTML = `
      <style>
        #main-menu {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: #000;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 200;
          font-family: 'Courier New', monospace;
          cursor: default;
        }
        #main-menu h1 {
          font-size: 72px;
          color: #ff2200;
          text-shadow: 0 0 20px #ff2200, 0 0 40px #880000;
          letter-spacing: 12px;
          margin-bottom: 10px;
          animation: flicker 3s infinite;
        }
        @keyframes flicker {
          0%, 100% { opacity: 1; }
          92% { opacity: 1; }
          93% { opacity: 0.4; }
          94% { opacity: 1; }
          96% { opacity: 0.6; }
          97% { opacity: 1; }
        }
        #main-menu .tagline {
          color: #666;
          font-size: 14px;
          letter-spacing: 4px;
          margin-bottom: 60px;
        }
        #main-menu .start-btn {
          color: #88ff88;
          font-family: 'Courier New', monospace;
          font-size: 20px;
          background: none;
          border: 1px solid rgba(136, 255, 136, 0.3);
          padding: 12px 40px;
          cursor: pointer;
          letter-spacing: 4px;
          transition: all 0.2s;
          text-shadow: 0 0 4px #44aa44;
        }
        #main-menu .start-btn:hover {
          background: rgba(136, 255, 136, 0.1);
          border-color: rgba(136, 255, 136, 0.6);
          text-shadow: 0 0 8px #88ff88;
        }
        #main-menu .controls {
          position: absolute;
          bottom: 40px;
          color: #444;
          font-size: 11px;
          text-align: center;
          line-height: 1.8;
          letter-spacing: 1px;
        }
      </style>
      <h1>DEADWIRE</h1>
      <div class="tagline">KEEP THE LIGHTS ON. FIND THE KEY. KILL THE DARK.</div>
      <button class="start-btn">START GAME</button>
      <div class="controls">
        WASD - Move | SHIFT - Sprint | F - Flashlight | E - Interact<br>
        TAB - Camera Monitor | ESC - Pause | MOUSE - Look
      </div>
    `;

    document.body.appendChild(this.container);

    const btn = this.container.querySelector('.start-btn')!;
    btn.addEventListener('click', () => {
      this.hide();
      this.onStart();
    });
  }

  show(): void {
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  dispose(): void {
    this.container.remove();
  }
}
