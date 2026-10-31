const ROOT = './assets/local/cf_bio_candidates/zone13/runtime-extras/overlays/';

export class Zone13Presentation {
  constructor(root) {
    this.root = root || null;
    this.power = root?.querySelector('[data-zone13-power]') || null;
    this.eye = root?.querySelector('[data-zone13-eye]') || null;
    this.flash = root?.querySelector('[data-zone13-flash]') || null;
    this.victory = root?.querySelector('[data-zone13-victory]') || null;
    this.tier = -1;
    this.flashT = 0;
    this.victoryT = 0;
    this.winner = null;
    this.active = false;
  }

  reset() {
    this.tier = -1; this.flashT = 0; this.victoryT = 0; this.winner = null;
    this.update(0, null, false);
  }

  flashInfection() {
    this.flashT = 1.15;
    if (this.flash) this.flash.src = `${ROOT}zbview.png`;
  }

  showVictory(winner) {
    this.winner = winner;
    this.victoryT = 2.8;
    if (this.victory) this.victory.src = `${ROOT}${winner === 'human' ? 'soldierwin' : 'ghostwin'}.png`;
  }

  update(dt, status, active) {
    this.active = !!active;
    this.flashT = Math.max(0, this.flashT - (dt || 0));
    this.victoryT = Math.max(0, this.victoryT - (dt || 0));
    const live = this.active && !!status && (status.phase === 'prepare' || status.phase === 'live');
    const zombie = live && !!status.playerZombie;
    const tier = live && !zombie
      ? Math.max(0, Math.min(10, Math.round(((status.humanDamageMultiplier || 1) - 1) / .1))) : -1;
    if (tier !== this.tier) {
      this.tier = tier;
      if (this.power && tier >= 0) this.power.src = `${ROOT}power${tier}.png`;
    }
    if (this.root) this.root.classList.toggle('active', this.active || this.victoryT > 0);
    if (this.power) this.power.classList.toggle('visible', tier >= 0);
    if (this.eye) {
      if (!this.eye.src) this.eye.src = `${ROOT}zbeye.png`;
      this.eye.classList.toggle('visible', zombie);
    }
    if (this.flash) this.flash.classList.toggle('visible', this.active && this.flashT > 0);
    if (this.victory) this.victory.classList.toggle('visible', this.victoryT > 0);
  }

  state() {
    return { active: this.active, tier: this.tier, flashT: this.flashT,
      victoryT: this.victoryT, winner: this.winner,
      powerVisible: !!this.power?.classList.contains('visible'),
      eyeVisible: !!this.eye?.classList.contains('visible'),
      victoryVisible: !!this.victory?.classList.contains('visible') };
  }
}
