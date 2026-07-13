function buildAboutChess() {
  const ac = document.getElementById('about-chess');
  if (!ac) return;
  const icons=['⚖️','📋','🏛️','📜','🔒','👷'];
  for(let r=0;r<4;r++) for(let c=0;c<6;c++){
    const cell=document.createElement('div');
    cell.className='ac '+((r+c)%2===0?'l':'d');
    if(r===1&&c<6) cell.textContent=icons[c];
    ac.appendChild(cell);
  }
}

document.addEventListener('DOMContentLoaded', buildAboutChess);
