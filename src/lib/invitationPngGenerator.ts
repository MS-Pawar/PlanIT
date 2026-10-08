import {
  formatEventDateReadable,
  formatEventTime12h,
} from '../shared/calculations.ts';
import {
  CustomSubEvent,
  GuestItem,
  InvitationThemeStyle,
} from '../shared/types.ts';

interface CanvasThemePalette {
  bg: string;
  outerBorder: string;
  innerBorder: string;
  accent: string;
  title: string;
  body: string;
  boxBg: string;
}

const CANVAS_THEMES: Record<InvitationThemeStyle, CanvasThemePalette> = {
  'ivory-gold': {
    bg: '#FAF6EE',
    outerBorder: '#C5A059',
    innerBorder: '#D8BE8A',
    accent: '#8C6523',
    title: '#1F1714',
    body: '#4A3B34',
    boxBg: '#F4ECE0',
  },
  'crimson-heritage': {
    bg: '#5B1217',
    outerBorder: '#D4AF37',
    innerBorder: '#B6922E',
    accent: '#F3CE7A',
    title: '#FFF8EB',
    body: '#F2DEC4',
    boxBg: '#4A0E12',
  },
  'emerald-botanical': {
    bg: '#12352B',
    outerBorder: '#A7C4A0',
    innerBorder: '#7EA376',
    accent: '#C8E2C0',
    title: '#FFFFFF',
    body: '#DCE7DA',
    boxBg: '#0D2820',
  },
  'midnight-regal': {
    bg: '#0F172A',
    outerBorder: '#E2B86B',
    innerBorder: '#B89249',
    accent: '#E2B86B',
    title: '#FFFFFF',
    body: '#CBD5E1',
    boxBg: '#1E293B',
  },
};

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = (text || '').trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface GeneratedInvitationPng {
  dataUrl: string;
  base64Data: string;
  blob: Blob;
  file: File;
  filename: string;
}

/**
 * Generates a high-resolution (1080x1380) PNG image of the Formal Invitation Card
 * personalized for a specific guest (or generic if no guest is passed).
 */
export async function generateInvitationPng(
  evt: CustomSubEvent,
  guest?: GuestItem | null
): Promise<GeneratedInvitationPng> {
  const width = 1080;
  const height = 1380;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not available');
  }

  const palette = CANVAS_THEMES[evt.cardTheme || 'ivory-gold'] || CANVAS_THEMES['ivory-gold'];

  // 1. Background fill
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);

  // 2. Outer & Inner Ornamental Borders
  ctx.strokeStyle = palette.outerBorder;
  ctx.lineWidth = 6;
  ctx.strokeRect(44, 44, width - 88, height - 88);

  ctx.strokeStyle = palette.innerBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(64, 64, width - 128, height - 128);

  // Corner ornaments
  const corners = [
    [64, 64],
    [width - 64, 64],
    [64, height - 64],
    [width - 64, height - 64],
  ];
  ctx.fillStyle = palette.outerBorder;
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = 'center';
  let y = 140;

  // 3. Top Invocation
  ctx.fillStyle = palette.accent;
  ctx.font = '600 22px "Plus Jakarta Sans", Georgia, serif';
  ctx.fillText((evt.invocationText || 'WITH WARM BLESSINGS').toUpperCase(), width / 2, y);
  y += 58;

  // 4. Guest Personalized Salutation
  ctx.fillStyle = palette.title;
  ctx.font = 'italic 600 28px Georgia, serif';
  const salutation = guest?.name
    ? `Dear ${guest.name} & Family (${guest.headcount || 1} Guests),`
    : 'Dear Family & Friends,';
  ctx.fillText(salutation, width / 2, y);
  y += 55;

  // 5. Host Invitation Line
  ctx.fillStyle = palette.body;
  ctx.font = '400 24px "Plus Jakarta Sans", sans-serif';
  const hostLines = wrapCanvasText(
    ctx,
    evt.hostLine || 'Together with their families, we cordially invite you to celebrate',
    width - 240
  );
  for (const line of hostLines) {
    ctx.fillText(line, width / 2, y);
    y += 36;
  }
  y += 32;

  // 6. Bride & Groom Names + Parents
  const bride = evt.brideName?.trim() || "Bride's Name";
  const groom = evt.groomName?.trim() || "Groom's Name";

  ctx.fillStyle = palette.title;
  ctx.font = 'bold 58px Georgia, serif';
  ctx.fillText(bride, width / 2, y);
  y += 38;

  if (evt.brideFamily?.trim()) {
    ctx.fillStyle = palette.body;
    ctx.font = '400 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`(D/o ${evt.brideFamily.trim()})`, width / 2, y);
    y += 42;
  } else {
    y += 16;
  }

  ctx.fillStyle = palette.accent;
  ctx.font = 'italic 36px Georgia, serif';
  ctx.fillText('&', width / 2, y);
  y += 58;

  ctx.fillStyle = palette.title;
  ctx.font = 'bold 58px Georgia, serif';
  ctx.fillText(groom, width / 2, y);
  y += 38;

  if (evt.groomFamily?.trim()) {
    ctx.fillStyle = palette.body;
    ctx.font = '400 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`(S/o ${evt.groomFamily.trim()})`, width / 2, y);
    y += 46;
  } else {
    y += 20;
  }

  // 7. Ornamental Divider
  ctx.strokeStyle = palette.outerBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 140, y);
  ctx.lineTo(width / 2 + 140, y);
  ctx.stroke();
  y += 52;

  // 8. Ceremony Category & Event Title
  ctx.fillStyle = palette.accent;
  ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`${evt.eventCategory.toUpperCase()} CELEBRATION`, width / 2, y);
  y += 46;

  ctx.fillStyle = palette.title;
  ctx.font = 'bold 40px Georgia, serif';
  const titleLines = wrapCanvasText(ctx, evt.eventTitle || 'Auspicious Ceremony', width - 200);
  for (const tl of titleLines) {
    ctx.fillText(tl, width / 2, y);
    y += 48;
  }
  y += 18;

  // 9. Date/Time Box & Venue Box
  const boxWidth = width - 220;
  const boxX = 110;
  const boxHeight = 190;

  ctx.fillStyle = palette.boxBg;
  ctx.fillRect(boxX, y, boxWidth, boxHeight);
  ctx.strokeStyle = palette.innerBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(boxX, y, boxWidth, boxHeight);

  let boxY = y + 44;
  ctx.fillStyle = palette.accent;
  ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('DATE, MUHURTHAM TIME & VENUE', width / 2, boxY);
  boxY += 40;

  ctx.fillStyle = palette.title;
  ctx.font = 'bold 27px Georgia, serif';
  ctx.fillText(
    `${formatEventDateReadable(evt.eventDate)}  ·  ${formatEventTime12h(evt.eventTime)} Onwards`,
    width / 2,
    boxY
  );
  boxY += 42;

  ctx.fillStyle = palette.title;
  ctx.font = '600 25px "Plus Jakarta Sans", sans-serif';
  const venueStr = [evt.venue || 'Venue TBD', evt.address, evt.city]
    .filter(Boolean)
    .join(', ');
  const venueLines = wrapCanvasText(ctx, venueStr, boxWidth - 60).slice(0, 2);
  for (const vl of venueLines) {
    ctx.fillText(vl, width / 2, boxY);
    boxY += 32;
  }

  y += boxHeight + 52;

  // 10. Custom Body Wording
  if (evt.bodyWording?.trim()) {
    ctx.fillStyle = palette.body;
    ctx.font = '400 23px "Plus Jakarta Sans", sans-serif';
    const bodyLines = wrapCanvasText(ctx, evt.bodyWording.trim(), width - 220).slice(0, 4);
    for (const bl of bodyLines) {
      ctx.fillText(bl, width / 2, y);
      y += 34;
    }
  }

  // 11. Footer (Dress Code & RSVP)
  const footerY = height - 105;
  ctx.strokeStyle = palette.innerBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(110, footerY - 34);
  ctx.lineTo(width - 110, footerY - 34);
  ctx.stroke();

  ctx.fillStyle = palette.body;
  ctx.font = '500 20px "Plus Jakarta Sans", sans-serif';
  const dressLine = evt.dressCode
    ? `Dress Code: ${evt.dressCode}`
    : 'With Best Compliments From Both Families';
  const rsvpLine = evt.rsvpContact ? `RSVP: ${evt.rsvpContact}` : 'Awaiting Your Gracious Presence';
  ctx.fillText(`${dressLine}   |   ${rsvpLine}`, width / 2, footerY);

  const dataUrl = canvas.toDataURL('image/png');
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Failed to create PNG Blob from invitation canvas'));
    }, 'image/png');
  });

  const safeEvent = (evt.eventCategory || 'Invitation').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeGuest = (guest?.name || 'Guest').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `PlanEase_${safeEvent}_Invitation_${safeGuest}.png`;
  const file = new File([blob], filename, { type: 'image/png' });

  return {
    dataUrl,
    base64Data,
    blob,
    file,
    filename,
  };
}

/**
 * Triggers a browser download of the generated PNG file.
 */
export function triggerPngDownload(png: GeneratedInvitationPng): void {
  const url = URL.createObjectURL(png.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = png.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copies the generated PNG image to the system clipboard so it can be pasted directly into WhatsApp Web/Desktop.
 */
export async function copyPngToClipboard(png: GeneratedInvitationPng): Promise<boolean> {
  try {
    if (navigator.clipboard && 'write' in navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      const item = new ClipboardItem({ 'image/png': png.blob });
      await navigator.clipboard.write([item]);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
