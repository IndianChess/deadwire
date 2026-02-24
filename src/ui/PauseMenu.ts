export class PauseMenu {
  private container: HTMLDivElement;
  private onResume: () => void;

  constructor(onResume: () => void) {
    this.onResume = onResume;

    this.container = document.createElement('div');
    this.container.id = 'pause-menu';
    this.container.innerHTML = `
      <style>
        #pause-menu {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          display: none;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 200;
          font-family: 'Courier New', monospace;
        }
        #pause-menu h2 {
          color: #88ff88;
          font-size: 36px;
          letter-spacing: 8px;
          margin-bottom: 40px;
          text-shadow: 0 0 10px #44aa44;
        }
        #pause-menu .resume-btn {
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
        #pause-menu .resume-btn:hover {
          background: rgba(136, 255, 136, 0.1);
          border-color: rgba(136, 255, 136, 0.6);
        }
      </style>
      <h2>PAUSED</h2>
      <button class="resume-btn">RESUME</button>
    `;

    document.body.appendChild(this.container);

    this.container.querySelector('.resume-btn')!.addEventListener('click', () => {
      this.hide();
      this.onResume();
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
