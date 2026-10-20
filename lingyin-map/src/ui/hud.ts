import type { Shot } from '../data/shots';

export class Hud {
  private shotButtons: HTMLButtonElement[] = [];
  private sampleEl: HTMLElement;
  private captionEl: HTMLElement;
  private tourBtn: HTMLButtonElement;
  private qualityBtn: HTMLButtonElement;
  private loading: HTMLElement;

  constructor(
    shots: Shot[],
    onShot: (i: number) => void,
    onTour: () => void,
    onQuality: () => void,
  ) {
    this.sampleEl = document.querySelector('#sample-count') as HTMLElement;
    this.captionEl = document.querySelector('#caption') as HTMLElement;
    this.tourBtn = document.querySelector('#tour-btn') as HTMLButtonElement;
    this.qualityBtn = document.querySelector('#quality-btn') as HTMLButtonElement;
    this.loading = document.querySelector('#loading') as HTMLElement;
    const nav = document.querySelector('#shot-nav') as HTMLElement;
    nav.innerHTML = '';
    for (const s of shots) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.shot = String(s.index - 1);
      b.innerHTML = `<span>${String(s.index).padStart(2, '0')}</span><em>${s.name}</em><i>${s.en}</i>`;
      b.addEventListener('click', () => onShot(s.index - 1));
      nav.appendChild(b);
      this.shotButtons.push(b);
    }
    this.tourBtn.addEventListener('click', onTour);
    this.qualityBtn.addEventListener('click', onQuality);
  }

  setActive(index: number) {
    this.shotButtons.forEach((b, i) => b.classList.toggle('is-active', i === index));
    const s = this.shotButtons[index];
    if (s) this.captionEl.textContent = `${s.querySelector('em')?.textContent ?? ''} · MORNING MIST`;
  }

  setSamples(n: number, max: number) {
    this.sampleEl.textContent = n >= max ? 'STILL' : `ACCUM ${String(n).padStart(2, '0')}/${max}`;
  }

  setTour(on: boolean) {
    this.tourBtn.classList.toggle('is-on', on);
    this.tourBtn.textContent = on ? '巡游中' : '巡游';
  }

  setQuality(label: string) {
    this.qualityBtn.textContent = label;
  }

  ready() {
    this.loading.classList.add('is-hidden');
    window.setTimeout(() => this.loading.remove(), 650);
  }

  error(message: string) {
    this.loading.classList.remove('is-hidden');
    this.loading.innerHTML = `<div class="load-cn">無法生成</div><div class="load-sub">${message}</div>`;
  }
}
