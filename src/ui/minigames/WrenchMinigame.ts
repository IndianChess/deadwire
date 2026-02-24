export class WrenchMinigame {
  private container: HTMLDivElement | null = null;

  start(): Promise<boolean> {
    return new Promise(resolve => {
      this.container = document.createElement('div');
      this.container.id = 'wrench-minigame';
      this.container.innerHTML = `
        <style>
          #wrench-minigame {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 300;
            font-family: 'Courier New', monospace;
          }
          #wrench-minigame .title {
            color: #ffaa00;
            font-size: 18px;
            letter-spacing: 3px;
            margin-bottom: 20px;
            text-shadow: 0 0 8px #ff8800;
          }
          #wrench-minigame .keys {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
          }
          #wrench-minigame .key-box {
            width: 50px;
            height: 50px;
            border: 2px solid rgba(136, 255, 136, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            color: #88ff88;
            transition: all 0.15s;
          }
          #wrench-minigame .key-box.active {
            border-color: #88ff88;
            background: rgba(136, 255, 136, 0.15);
            box-shadow: 0 0 10px rgba(136, 255, 136, 0.3);
          }
          #wrench-minigame .key-box.success {
            border-color: #44ff44;
            background: rgba(68, 255, 68, 0.3);
            color: #44ff44;
          }
          #wrench-minigame .key-box.fail {
            border-color: #ff4444;
            background: rgba(255, 68, 68, 0.2);
            color: #ff4444;
          }
          #wrench-minigame .timer-bar {
            width: 250px;
            height: 4px;
            background: rgba(60, 60, 60, 0.5);
            margin-top: 15px;
          }
          #wrench-minigame .timer-fill {
            height: 100%;
            background: #88ff88;
            transition: width 0.1s linear;
            box-shadow: 0 0 4px #44aa44;
          }
        </style>
        <div class="title">REPAIR GENERATOR</div>
        <div class="keys" id="mg-keys"></div>
        <div class="timer-bar"><div class="timer-fill" id="mg-timer"></div></div>
      `;
      document.body.appendChild(this.container);

      const keys = ['Q', 'E', 'R', 'F', 'Z', 'X', 'C'];
      const sequence: string[] = [];
      const seqLength = 4;
      for (let i = 0; i < seqLength; i++) {
        sequence.push(keys[Math.floor(Math.random() * keys.length)]);
      }

      const keysContainer = this.container.querySelector('#mg-keys')!;
      const keyBoxes: HTMLDivElement[] = [];
      for (const key of sequence) {
        const box = document.createElement('div');
        box.className = 'key-box';
        box.textContent = key;
        keysContainer.appendChild(box);
        keyBoxes.push(box);
      }

      let currentIdx = 0;
      keyBoxes[0].classList.add('active');

      const timeLimit = 5000;
      const startTime = performance.now();
      const timerFill = this.container.querySelector('#mg-timer') as HTMLDivElement;

      const timerInterval = setInterval(() => {
        const elapsed = performance.now() - startTime;
        const pct = Math.max(0, 1 - elapsed / timeLimit);
        timerFill.style.width = `${pct * 100}%`;
        if (pct <= 0.3) {
          timerFill.style.background = '#ff4444';
        }
      }, 50);

      const timeout = setTimeout(() => {
        cleanup(false);
      }, timeLimit);

      const onKeyDown = (e: KeyboardEvent) => {
        const pressed = e.key.toUpperCase();
        if (pressed === sequence[currentIdx]) {
          keyBoxes[currentIdx].classList.remove('active');
          keyBoxes[currentIdx].classList.add('success');
          currentIdx++;
          if (currentIdx >= sequence.length) {
            cleanup(true);
          } else {
            keyBoxes[currentIdx].classList.add('active');
          }
        } else {
          // Wrong key - fail
          keyBoxes[currentIdx].classList.add('fail');
          setTimeout(() => cleanup(false), 300);
        }
      };

      window.addEventListener('keydown', onKeyDown);

      const cleanup = (success: boolean) => {
        clearTimeout(timeout);
        clearInterval(timerInterval);
        window.removeEventListener('keydown', onKeyDown);
        setTimeout(() => {
          this.container?.remove();
          this.container = null;
          resolve(success);
        }, success ? 200 : 500);
      };
    });
  }
}
