export class GameOverScreen {
  private container: HTMLDivElement;
  private onRestart: () => void;

  constructor(onRestart: () => void) {
    this.onRestart = onRestart;

    this.container = document.createElement('div');
    this.container.id = 'game-over';
    this.container.innerHTML = `
      <style>
        #game-over {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.95);
          display: none;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 200;
          font-family: 'Courier New', monospace;
        }
        #game-over h2 {
          color: #ff2200;
          font-size: 48px;
          letter-spacing: 8px;
          margin-bottom: 20px;
          text-shadow: 0 0 20px #ff2200;
        }
        #game-over .death-msg {
          color: #666;
          font-size: 14px;
          letter-spacing: 2px;
          margin-bottom: 40px;
        }
        #game-over .restart-btn {
          color: #88ff88;
          font-family: 'Courier New', monospace;
          font-size: 18px;
          background: none;
          border: 1px solid rgba(136, 255, 136, 0.3);
          padding: 10px 30px;
          cursor: pointer;
          letter-spacing: 3px;
          transition: all 0.2s;
        }
        #game-over .restart-btn:hover {
          background: rgba(136, 255, 136, 0.1);
          border-color: rgba(136, 255, 136, 0.6);
        }
      </style>
      <h2>YOU DIED</h2>
      <div class="death-msg">THE DARKNESS CONSUMED YOU</div>
      <button class="restart-btn">TRY AGAIN</button>
    `;

    document.body.appendChild(this.container);

    this.container.querySelector('.restart-btn')!.addEventListener('click', () => {
      this.hide();
      this.onRestart();
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
