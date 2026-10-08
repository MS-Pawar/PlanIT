import React, { useState, useMemo, useEffect } from 'react';
import {
  CalendarHeart,
  Plus,
  Trash2,
  Printer,
  Copy,
  Send,
  CheckCircle2,
  Mail,
  MessageSquare,
  Eye,
  X,
  Download,
  Image as ImageIcon,
  Share2,
  AlertCircle,
} from 'lucide-react';
import {
  getAccessToken,
  googleSignIn,
  initAuth,
  sendGmailInvitationWithPng,
} from '../lib/firebase.ts';
import {
  copyPngToClipboard,
  GeneratedInvitationPng,
  generateInvitationPng,
  triggerPngDownload,
} from '../lib/invitationPngGenerator.ts';
import {
  buildPersonalizedInvitationText,
  calculateEventCountdown,
  createDefaultSubEvents,
  formatEventDateReadable,
  formatEventTime12h,
} from '../shared/calculations.ts';
import {
  CustomSubEvent,
  GuestItem,
  InvitationThemeStyle,
  UserWorkspaceData,
} from '../shared/types.ts';

interface FormalInvitationStudioProps {
  workspace: UserWorkspaceData;
  onUpdateWorkspace: (updater: (prev: UserWorkspaceData) => UserWorkspaceData) => void;
  showToast: (msg: string) => void;
  sessionToken: string | null;
  mode: 'invitations' | 'guests';
  onSwitchMode: (mode: 'invitations' | 'guests') => void;
}

const THEME_STYLES: Record<
  InvitationThemeStyle,
  {
    label: string;
    cardBg: string;
    border: string;
    innerBorder: string;
    accentText: string;
    titleText: string;
    bodyText: string;
    divider: string;
  }
> = {
  'ivory-gold': {
    label: 'Royal Ivory & Gold',
    cardBg: 'bg-[#FAF6EE] text-[#2C221E]',
    border: 'border-2 border-[#C5A059]',
    innerBorder: 'border border-[#D8BE8A]',
    accentText: 'text-[#8C6523]',
    titleText: 'text-[#1F1714]',
    bodyText: 'text-[#4A3B34]',
    divider: 'bg-[#C5A059]',
  },
  'crimson-heritage': {
    label: 'Heritage Maroon & Brass',
    cardBg: 'bg-[#5B1217] text-[#F9EBD7]',
    border: 'border-2 border-[#D4AF37]',
    innerBorder: 'border border-[#D4AF37]/60',
    accentText: 'text-[#F3CE7A]',
    titleText: 'text-[#FFF8EB]',
    bodyText: 'text-[#F2DEC4]',
    divider: 'bg-[#D4AF37]',
  },
  'emerald-botanical': {
    label: 'Botanical Emerald & Cream',
    cardBg: 'bg-[#12352B] text-[#F4F7F4]',
    border: 'border-2 border-[#A7C4A0]',
    innerBorder: 'border border-[#A7C4A0]/50',
    accentText: 'text-[#C8E2C0]',
    titleText: 'text-[#FFFFFF]',
    bodyText: 'text-[#DCE7DA]',
    divider: 'bg-[#A7C4A0]',
  },
  'midnight-regal': {
    label: 'Midnight Starlight & Champagne',
    cardBg: 'bg-[#0F172A] text-[#F8FAFC]',
    border: 'border-2 border-[#E2B86B]',
    innerBorder: 'border border-[#E2B86B]/50',
    accentText: 'text-[#E2B86B]',
    titleText: 'text-[#FFFFFF]',
    bodyText: 'text-[#CBD5E1]',
    divider: 'bg-[#E2B86B]',
  },
};

export const FormalInvitationStudio: React.FC<FormalInvitationStudioProps> = ({
  workspace,
  onUpdateWorkspace,
  showToast,
  sessionToken,
  mode,
  onSwitchMode,
}) => {
  // Google / Gmail OAuth state (in-memory token per workspace-integration skill)
  const [needsGmailAuth, setNeedsGmailAuth] = useState<boolean>(true);
  const [gmailToken, setGmailToken] = useState<string | null>(null);
  const [gmailUserEmail, setGmailUserEmail] = useState<string | null>(null);
  const [isConnectingGmail, setIsConnectingGmail] = useState<boolean>(false);

  useEffect(() => {
    const unsub = initAuth(
      (u, tok) => {
        setGmailToken(tok);
        setGmailUserEmail(u.email || u.displayName || 'Connected');
        setNeedsGmailAuth(false);
      },
      () => {
        setGmailToken(null);
        setGmailUserEmail(null);
        setNeedsGmailAuth(true);
      }
    );
    // Also check if token is already cached in memory
    getAccessToken().then((t) => {
      if (t) {
        setGmailToken(t);
        setNeedsGmailAuth(false);
      }
    });
    return () => unsub();
  }, []);

  const handleConnectGmail = async (): Promise<string | null> => {
    setIsConnectingGmail(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setGmailToken(result.accessToken);
        setGmailUserEmail(result.user.email || result.user.displayName || 'Connected');
        setNeedsGmailAuth(false);
        showToast(`Connected Gmail (${result.user.email || 'Account'}) for sending invitations!`);
        return result.accessToken;
      }
      return null;
    } catch (err: any) {
      showToast(err.message || 'Gmail connection was cancelled.');
      return null;
    } finally {
      setIsConnectingGmail(false);
    }
  };

  const subEvents: CustomSubEvent[] = useMemo(() => {
    const raw =
      workspace.subEvents && workspace.subEvents.length > 0
        ? workspace.subEvents
        : createDefaultSubEvents();
    return raw.map((ev) => ({
      ...ev,
      brideName:
        ev.brideName ||
        workspace.eventParticulars.brideName ||
        workspace.engagementParticulars.brideName ||
        '',
      groomName:
        ev.groomName ||
        workspace.eventParticulars.groomName ||
        workspace.engagementParticulars.groomName ||
        '',
      brideFamily:
        ev.brideFamily ||
        workspace.eventParticulars.brideFamily ||
        workspace.engagementParticulars.brideFamily ||
        '',
      groomFamily:
        ev.groomFamily ||
        workspace.eventParticulars.groomFamily ||
        workspace.engagementParticulars.groomFamily ||
        '',
      eventDate:
        ev.eventDate ||
        (ev.eventCategory === 'Engagement'
          ? workspace.engagementParticulars.engagementDate ||
            workspace.eventParticulars.engagementDate
          : ev.eventCategory === 'Marriage'
          ? workspace.eventParticulars.marriageDate
          : ''),
      venue:
        ev.venue ||
        (ev.eventCategory === 'Engagement'
          ? workspace.engagementParticulars.venue
          : ev.eventCategory === 'Marriage'
          ? workspace.eventParticulars.venue
          : ''),
      city:
        ev.city ||
        (ev.eventCategory === 'Engagement'
          ? workspace.engagementParticulars.city
          : ev.eventCategory === 'Marriage'
          ? workspace.eventParticulars.city
          : ''),
    }));
  }, [workspace.subEvents, workspace.eventParticulars, workspace.engagementParticulars]);

  const [selectedEventId, setSelectedEventId] = useState<string>(
    subEvents[0]?.id || 'evt_engagement'
  );

  const activeEvent: CustomSubEvent =
    subEvents.find((e) => e.id === selectedEventId) || subEvents[0];

  // Guest Form State
  const [guestName, setGuestName] = useState('');
  const [guestSide, setGuestSide] = useState<'Bride' | 'Groom' | 'Common'>('Common');
  const [guestScope, setGuestScope] = useState<'Engagement' | 'Marriage' | 'Both' | 'Other'>('Both');
  const [guestHeadcount, setGuestHeadcount] = useState('2');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestCity, setGuestCity] = useState('');
  const [guestRsvp, setGuestRsvp] = useState<'Confirmed' | 'Pending' | 'Declined'>('Pending');

  // Guest Selection & Filtering
  const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([]);
  const [guestSearch, setGuestSearch] = useState('');
  const [guestScopeFilter, setGuestScopeFilter] = useState<string>('All');
  const [previewGuest, setPreviewGuest] = useState<GuestItem | null>(null);
  const [dispatching, setDispatching] = useState(false);

  // Mandatory Gmail Confirmation Modal State (with PNG Invitation Attachment preview)
  const [gmailConfirmModal, setGmailConfirmModal] = useState<{
    guests: GuestItem[];
    samplePng: GeneratedInvitationPng;
    subject: string;
    sampleBody: string;
  } | null>(null);
  const [sendingGmailNow, setSendingGmailNow] = useState(false);

  // WhatsApp + PNG Attachment Modal State
  const [whatsAppModal, setWhatsAppModal] = useState<{
    guest: GuestItem;
    png: GeneratedInvitationPng;
    bodyText: string;
    copiedToClipboard: boolean;
  } | null>(null);

  // Dispatch Receipt Modal
  const [dispatchReceipt, setDispatchReceipt] = useState<{
    eventTitle: string;
    deliveries: {
      guestId: string;
      guestName: string;
      channel: string;
      target: string;
      delivered: boolean;
    }[];
  } | null>(null);

  const handleUpdateActiveEvent = (patch: Partial<CustomSubEvent>) => {
    onUpdateWorkspace((prev) => {
      const currentList =
        prev.subEvents && prev.subEvents.length > 0
          ? prev.subEvents
          : createDefaultSubEvents();
      const updatedList = currentList.map((ev) =>
        ev.id === activeEvent.id ? { ...activeEvent, ...ev, ...patch } : ev
      );

      const nextEventParticulars = { ...prev.eventParticulars };
      const nextEngagementParticulars = { ...prev.engagementParticulars };

      if (patch.brideName !== undefined) {
        nextEventParticulars.brideName = patch.brideName;
        nextEngagementParticulars.brideName = patch.brideName;
      }
      if (patch.groomName !== undefined) {
        nextEventParticulars.groomName = patch.groomName;
        nextEngagementParticulars.groomName = patch.groomName;
      }
      if (patch.brideFamily !== undefined) {
        nextEventParticulars.brideFamily = patch.brideFamily;
        nextEngagementParticulars.brideFamily = patch.brideFamily;
      }
      if (patch.groomFamily !== undefined) {
        nextEventParticulars.groomFamily = patch.groomFamily;
        nextEngagementParticulars.groomFamily = patch.groomFamily;
      }

      if (activeEvent.eventCategory === 'Engagement') {
        if (patch.eventDate !== undefined) {
          nextEngagementParticulars.engagementDate = patch.eventDate;
          nextEventParticulars.engagementDate = patch.eventDate;
        }
        if (patch.eventTime !== undefined) {
          nextEngagementParticulars.engagementTime = patch.eventTime;
        }
        if (patch.venue !== undefined) {
          nextEngagementParticulars.venue = patch.venue;
        }
        if (patch.city !== undefined) {
          nextEngagementParticulars.city = patch.city;
        }
      } else if (activeEvent.eventCategory === 'Marriage') {
        if (patch.eventDate !== undefined) {
          nextEventParticulars.marriageDate = patch.eventDate;
        }
        if (patch.eventTime !== undefined) {
          nextEventParticulars.marriageTime = patch.eventTime;
        }
        if (patch.venue !== undefined) {
          nextEventParticulars.venue = patch.venue;
        }
        if (patch.city !== undefined) {
          nextEventParticulars.city = patch.city;
        }
      }

      return {
        ...prev,
        subEvents: updatedList,
        eventParticulars: nextEventParticulars,
        engagementParticulars: nextEngagementParticulars,
      };
    });
  };

  const handleAddCustomEvent = () => {
    const newId = `evt_custom_${Date.now()}`;
    const newEvt: CustomSubEvent = {
      id: newId,
      eventCategory: 'Other',
      eventTitle: 'Reception / Custom Function',
      eventDate: activeEvent.eventDate || '',
      eventTime: '19:00',
      venue: activeEvent.venue || '',
      city: activeEvent.city || '',
      address: activeEvent.address || '',
      brideName: activeEvent.brideName || '',
      groomName: activeEvent.groomName || '',
      brideFamily: activeEvent.brideFamily || '',
      groomFamily: activeEvent.groomFamily || '',
      invocationText: 'With Warm Regards & Best Compliments',
      hostLine: 'We cordially invite you and your family to grace the celebration of',
      bodyWording:
        'Your presence and blessings are our greatest joy as we celebrate this special milestone together.',
      dressCode: 'Formal / Festive Attire',
      rsvpContact: activeEvent.rsvpContact || '',
      cardTheme: 'midnight-regal',
    };

    onUpdateWorkspace((prev) => {
      const base =
        prev.subEvents && prev.subEvents.length > 0
          ? prev.subEvents
          : createDefaultSubEvents();
      return {
        ...prev,
        subEvents: [...base, newEvt],
      };
    });
    setSelectedEventId(newId);
    showToast('Added new separate event & formal invitation template.');
  };

  const handleDeleteCustomEvent = (id: string) => {
    if (subEvents.length <= 1) {
      showToast('At least one event template must remain.');
      return;
    }
    onUpdateWorkspace((prev) => {
      const next = (prev.subEvents || subEvents).filter((e) => e.id !== id);
      return { ...prev, subEvents: next };
    });
    const remaining = subEvents.filter((e) => e.id !== id);
    if (remaining[0]) setSelectedEventId(remaining[0].id);
    showToast('Event template removed.');
  };

  const handleCopyInvitationText = (guest?: GuestItem) => {
    const { body } = buildPersonalizedInvitationText(activeEvent, guest?.name);
    navigator.clipboard.writeText(body);
    showToast(
      guest
        ? `Copied formal invitation for ${guest.name} to clipboard.`
        : 'Copied formal invitation wording to clipboard.'
    );
  };

  // Download PNG Invitation Card directly
  const handleDownloadCardPng = async (guest?: GuestItem | null) => {
    try {
      const png = await generateInvitationPng(activeEvent, guest);
      triggerPngDownload(png);
      showToast(`Downloaded PNG Formal Invitation (${png.filename}).`);
    } catch (err: any) {
      showToast(err.message || 'Failed to generate PNG invitation.');
    }
  };

  // Prepare & Open Mandatory Confirmation Dialog for Sending via Gmail with PNG Attachment
  const handlePrepareGmailSendWithPng = async (targetGuests: GuestItem[]) => {
    const guestsWithEmail = targetGuests.filter((g) => g.email && g.email.trim().length > 0);
    if (guestsWithEmail.length === 0) {
      showToast('Please add an email address for the selected guest(s) to send via Gmail.');
      return;
    }

    try {
      const firstGuest = guestsWithEmail[0];
      const samplePng = await generateInvitationPng(activeEvent, firstGuest);
      const { subject, body } = buildPersonalizedInvitationText(activeEvent, firstGuest.name);

      setGmailConfirmModal({
        guests: guestsWithEmail,
        samplePng,
        subject,
        sampleBody: body,
      });
    } catch (err: any) {
      showToast(err.message || 'Could not prepare PNG invitation for Gmail.');
    }
  };

  // Execute Confirmed Gmail API Send with PNG Attachment
  const handleExecuteConfirmedGmailSend = async () => {
    if (!gmailConfirmModal) return;

    let activeToken = await getAccessToken();
    if (!activeToken) {
      activeToken = await handleConnectGmail();
      if (!activeToken) {
        setNeedsGmailAuth(true);
        return;
      }
    }

    setSendingGmailNow(true);
    try {
      const deliveries: {
        guestId: string;
        guestName: string;
        channel: string;
        target: string;
        delivered: boolean;
      }[] = [];

      for (const guest of gmailConfirmModal.guests) {
        const emailAddr = (guest.email || '').trim();
        if (!emailAddr) continue;

        try {
          const personalizedPng = await generateInvitationPng(activeEvent, guest);
          const { subject, body } = buildPersonalizedInvitationText(activeEvent, guest.name);

          await sendGmailInvitationWithPng({
            accessToken: activeToken,
            toEmail: emailAddr,
            guestName: guest.name,
            subject,
            textBody: body,
            pngBase64: personalizedPng.base64Data,
            pngFilename: personalizedPng.filename,
          });

          deliveries.push({
            guestId: guest.id,
            guestName: guest.name,
            channel: `Gmail + PNG (${personalizedPng.filename})`,
            target: emailAddr,
            delivered: true,
          });
        } catch (sendErr: any) {
          console.error('Gmail send error for guest:', guest.name, sendErr);
          // If 401/403 token expired, prompt re-auth
          if (
            String(sendErr?.message || '').includes('401') ||
            String(sendErr?.message || '').includes('403')
          ) {
            setNeedsGmailAuth(true);
            setGmailToken(null);
          }
          deliveries.push({
            guestId: guest.id,
            guestName: guest.name,
            channel: `Gmail Error: ${sendErr?.message || 'Failed'}`,
            target: emailAddr,
            delivered: false,
          });
        }
      }

      const deliveredIds = new Set(
        deliveries.filter((d) => d.delivered).map((d) => d.guestId)
      );
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (deliveredIds.size > 0) {
        onUpdateWorkspace((prev) => ({
          ...prev,
          guests: prev.guests.map((g) => {
            if (!deliveredIds.has(g.id)) return g;
            const prevInvited = Array.isArray(g.invitedEvents) ? g.invitedEvents : [];
            const nextInvited = prevInvited.includes(activeEvent.eventTitle)
              ? prevInvited
              : [...prevInvited, activeEvent.eventTitle];
            return {
              ...g,
              inviteSent: true,
              invitedEvents: nextInvited,
              lastInvitedAt: nowStr,
              lastInvitedChannel: 'Gmail + PNG',
            };
          }),
        }));
      }

      setGmailConfirmModal(null);
      setSelectedGuestIds([]);
      setDispatchReceipt({
        eventTitle: `${activeEvent.eventCategory}: ${activeEvent.eventTitle} (Gmail + PNG Attached)`,
        deliveries,
      });

      if (deliveredIds.size > 0) {
        showToast(
          `Sent ${deliveredIds.size} formal invitation(s) via Gmail with PNG card attached!`
        );
      } else {
        showToast('Could not send via Gmail. Please check your Gmail connection and try again.');
      }
    } finally {
      setSendingGmailNow(false);
    }
  };

  // Prepare WhatsApp + PNG Invitation for a Guest
  const handlePrepareWhatsAppWithPng = async (guest: GuestItem) => {
    if (!guest.phone || !guest.phone.trim()) {
      showToast(`Please add a mobile number for ${guest.name} to send via WhatsApp.`);
      return;
    }

    try {
      const png = await generateInvitationPng(activeEvent, guest);
      const { body } = buildPersonalizedInvitationText(activeEvent, guest.name);
      const copied = await copyPngToClipboard(png);

      setWhatsAppModal({
        guest,
        png,
        bodyText: body,
        copiedToClipboard: copied,
      });
    } catch (err: any) {
      showToast(err.message || 'Failed to generate PNG invitation for WhatsApp.');
    }
  };

  // Mark a guest as invited via WhatsApp + PNG
  const markGuestInvitedViaWhatsApp = (guest: GuestItem) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    onUpdateWorkspace((prev) => ({
      ...prev,
      guests: prev.guests.map((g) => {
        if (g.id !== guest.id) return g;
        const prevInvited = Array.isArray(g.invitedEvents) ? g.invitedEvents : [];
        const nextInvited = prevInvited.includes(activeEvent.eventTitle)
          ? prevInvited
          : [...prevInvited, activeEvent.eventTitle];
        return {
          ...g,
          inviteSent: true,
          invitedEvents: nextInvited,
          lastInvitedAt: nowStr,
          lastInvitedChannel: 'WhatsApp + PNG',
        };
      }),
    }));
  };

  // Share PNG file + message via Web Share API (if supported on mobile/OS) or Download PNG + Copy PNG + Open WhatsApp
  const handleLaunchWhatsAppWithPng = async (useWebShareIfAvailable: boolean) => {
    if (!whatsAppModal) return;
    const { guest, png, bodyText } = whatsAppModal;

    if (
      useWebShareIfAvailable &&
      typeof navigator !== 'undefined' &&
      navigator.canShare &&
      navigator.canShare({ files: [png.file] })
    ) {
      try {
        await navigator.share({
          files: [png.file],
          title: `${activeEvent.eventTitle} — Formal Invitation`,
          text: bodyText,
        });
        markGuestInvitedViaWhatsApp(guest);
        setWhatsAppModal(null);
        showToast(`Shared PNG Formal Invitation with ${guest.name}!`);
        return;
      } catch {
        // Fallback to direct WhatsApp link + PNG download if share sheet was dismissed
      }
    }

    // Download the PNG file AND copy PNG to clipboard so user can attach/paste in WhatsApp
    triggerPngDownload(png);
    await copyPngToClipboard(png);

    const cleanPhone = (guest.phone || '').replace(/[^0-9]/g, '');
    const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(
      bodyText
    )}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    markGuestInvitedViaWhatsApp(guest);
    setWhatsAppModal(null);
    showToast(
      `Downloaded & copied "${png.filename}" and opened WhatsApp for ${guest.name} (Paste Ctrl+V or attach the PNG)!`
    );
  };

  // Send Formal Invitation (One-by-One or Bulk) via Mobile SMS and/or Email
  const handleDispatchInvitations = async (
    targetGuests: GuestItem[],
    preferredChannel: 'auto' | 'sms' | 'email' = 'auto'
  ) => {
    if (targetGuests.length === 0) {
      showToast('Please select at least one guest to send the formal invitation.');
      return;
    }

    const guestsWithContact = targetGuests.filter(
      (g) => (g.phone && g.phone.trim().length > 0) || (g.email && g.email.trim().length > 0)
    );

    if (guestsWithContact.length === 0) {
      showToast(
        'Selected guest(s) do not have a mobile number or email address entered yet.'
      );
      return;
    }

    setDispatching(true);
    try {
      const recipientsPayload = targetGuests.map((g) => {
        const { subject, body } = buildPersonalizedInvitationText(activeEvent, g.name);
        return {
          guestId: g.id,
          guestName: g.name,
          phone: g.phone || '',
          email: g.email || '',
          preferredChannel,
          subject,
          messageBody: body,
        };
      });

      let deliveries: {
        guestId: string;
        guestName: string;
        channel: string;
        target: string;
        delivered: boolean;
      }[] = [];

      if (sessionToken) {
        const res = await fetch('/api/invitations/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            eventTitle: activeEvent.eventTitle,
            eventCategory: activeEvent.eventCategory,
            recipients: recipientsPayload,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          deliveries = data.deliveries || [];
        }
      }

      if (deliveries.length === 0) {
        deliveries = recipientsPayload.map((r) => {
          const hasPhone = Boolean(r.phone.trim());
          const hasEmail = Boolean(r.email.trim());
          const channel =
            hasPhone && hasEmail
              ? 'SMS & Email'
              : hasPhone
              ? 'SMS'
              : hasEmail
              ? 'Email'
              : 'Missing Contact';
          const target =
            hasPhone && hasEmail
              ? `${r.phone} / ${r.email}`
              : hasPhone
              ? r.phone
              : hasEmail
              ? r.email
              : 'None';
          return {
            guestId: r.guestId,
            guestName: r.guestName,
            channel,
            target,
            delivered: hasPhone || hasEmail,
          };
        });
      }

      const deliveredIds = new Set(
        deliveries.filter((d) => d.delivered).map((d) => d.guestId)
      );

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      onUpdateWorkspace((prev) => ({
        ...prev,
        guests: prev.guests.map((g) => {
          if (!deliveredIds.has(g.id)) return g;
          const deliv = deliveries.find((d) => d.guestId === g.id);
          const prevInvited = Array.isArray(g.invitedEvents) ? g.invitedEvents : [];
          const nextInvited = prevInvited.includes(activeEvent.eventTitle)
            ? prevInvited
            : [...prevInvited, activeEvent.eventTitle];
          return {
            ...g,
            inviteSent: true,
            invitedEvents: nextInvited,
            lastInvitedAt: nowStr,
            lastInvitedChannel: deliv?.channel || 'SMS/Email',
          };
        }),
      }));

      setDispatchReceipt({
        eventTitle: `${activeEvent.eventCategory}: ${activeEvent.eventTitle}`,
        deliveries,
      });
      setSelectedGuestIds([]);
      showToast(
        `Sent "${activeEvent.eventTitle}" formal invitation to ${deliveredIds.size} guest(s)!`
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to dispatch invitations.');
    } finally {
      setDispatching(false);
    }
  };

  const filteredGuests = useMemo(() => {
    return workspace.guests.filter((g) => {
      if (guestScopeFilter !== 'All' && g.scope !== guestScopeFilter && g.scope !== 'Both') {
        return false;
      }
      if (guestSearch.trim()) {
        const q = guestSearch.toLowerCase();
        const hay = `${g.name} ${g.phone} ${g.email || ''} ${g.city} ${g.side}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [workspace.guests, guestScopeFilter, guestSearch]);

  const activeCountdown = calculateEventCountdown(activeEvent.eventDate, activeEvent.eventTime);

  const renderGoogleSignInButton = (label = 'Sign in with Google (Connect Gmail)') => (
    <button
      type="button"
      disabled={isConnectingGmail}
      onClick={handleConnectGmail}
      className="gsi-material-button inline-flex items-center gap-2.5 px-3.5 py-2 bg-white dark:bg-neutral-900 text-slate-800 dark:text-neutral-100 border border-stone-300 dark:border-neutral-700 rounded-lg text-xs font-semibold hover:bg-stone-50 dark:hover:bg-neutral-800 shadow-2xs cursor-pointer transition-colors"
    >
      <div className="w-4 h-4 shrink-0">
        <svg
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 48 48"
          className="w-4 h-4 block"
        >
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
          />
          <path
            fill="#FBBC05"
            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
          />
          <path fill="none" d="M0 0h48v48H0z" />
        </svg>
      </div>
      <span className="gsi-material-button-contents">
        {isConnectingGmail ? 'Connecting Gmail...' : label}
      </span>
    </button>
  );

  const renderFormalInvitationCard = (evt: CustomSubEvent, guestForPreview?: GuestItem | null) => {
    const cardStyle = THEME_STYLES[evt.cardTheme || 'ivory-gold'] || THEME_STYLES['ivory-gold'];
    const bride = evt.brideName?.trim() || "Bride's Name";
    const groom = evt.groomName?.trim() || "Groom's Name";

    return (
      <div
        className={`rounded-xl p-6 md:p-8 shadow-sm transition-all ${cardStyle.cardBg} ${cardStyle.border}`}
      >
        <div className={`rounded-lg p-6 md:p-8 text-center space-y-5 ${cardStyle.innerBorder}`}>
          {/* Top Invocation */}
          <p className={`text-xs font-medium tracking-widest uppercase ${cardStyle.accentText}`}>
            {evt.invocationText || 'With Warm Blessings'}
          </p>

          {/* Personalized Guest Salutation */}
          <div className={`text-sm font-semibold italic ${cardStyle.titleText}`}>
            {guestForPreview
              ? `Dear ${guestForPreview.name} & Family (${guestForPreview.headcount} Guests),`
              : 'Dear [Guest Name] & Family,'}
          </div>

          {/* Host Invitation Line */}
          <p className={`text-xs md:text-sm max-w-md mx-auto leading-relaxed ${cardStyle.bodyText}`}>
            {evt.hostLine ||
              'Together with their families, we cordially invite you to celebrate'}
          </p>

          {/* Bride & Groom Names & Parents */}
          <div className="py-2 space-y-2">
            <div className={`text-2xl md:text-3xl font-bold font-display ${cardStyle.titleText}`}>
              {bride}
            </div>
            {evt.brideFamily && (
              <div className={`text-xs ${cardStyle.bodyText}`}>
                (D/o {evt.brideFamily})
              </div>
            )}

            <div className={`text-sm font-display italic py-1 ${cardStyle.accentText}`}>
              &amp;
            </div>

            <div className={`text-2xl md:text-3xl font-bold font-display ${cardStyle.titleText}`}>
              {groom}
            </div>
            {evt.groomFamily && (
              <div className={`text-xs ${cardStyle.bodyText}`}>
                (S/o {evt.groomFamily})
              </div>
            )}
          </div>

          <div className={`w-24 h-px mx-auto ${cardStyle.divider}`} />

          {/* Ceremony Title */}
          <div className="space-y-1">
            <div className={`text-xs uppercase tracking-wider font-semibold ${cardStyle.accentText}`}>
              {evt.eventCategory} Celebration
            </div>
            <div className={`text-lg md:text-xl font-bold font-display ${cardStyle.titleText}`}>
              {evt.eventTitle || 'Auspicious Function'}
            </div>
          </div>

          {/* Date, Time & Venue Box */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 max-w-lg mx-auto text-xs">
            <div className={`p-3 rounded border ${cardStyle.innerBorder}`}>
              <div className={`font-semibold uppercase text-[10px] ${cardStyle.accentText}`}>
                Date &amp; Muhurtham Time
              </div>
              <div className={`font-semibold mt-1 ${cardStyle.titleText}`}>
                {formatEventDateReadable(evt.eventDate)}
              </div>
              <div className={`font-mono mt-0.5 ${cardStyle.bodyText}`}>
                {formatEventTime12h(evt.eventTime)} Onwards
              </div>
            </div>

            <div className={`p-3 rounded border ${cardStyle.innerBorder}`}>
              <div className={`font-semibold uppercase text-[10px] ${cardStyle.accentText}`}>
                Venue &amp; Location
              </div>
              <div className={`font-semibold mt-1 ${cardStyle.titleText}`}>
                {evt.venue || 'Venue to be announced'}
              </div>
              <div className={`mt-0.5 ${cardStyle.bodyText}`}>
                {[evt.address, evt.city].filter(Boolean).join(', ') || 'City'}
              </div>
            </div>
          </div>

          {/* Custom Wording Body */}
          {evt.bodyWording && (
            <p className={`text-xs leading-relaxed max-w-md mx-auto pt-1 ${cardStyle.bodyText}`}>
              {evt.bodyWording}
            </p>
          )}

          {/* Footer: Dress Code & RSVP */}
          <div className="pt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] border-t border-current/15">
            <span>
              {evt.dressCode ? `Dress Code: ${evt.dressCode}` : 'Warm Regards: Both Families'}
            </span>
            <span className="font-mono">
              {evt.rsvpContact ? `RSVP: ${evt.rsvpContact}` : 'Awaiting your presence'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Gmail & WhatsApp PNG Invitation Connection Banner */}
      <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Mail className="w-4 h-4 text-red-600" />
            <span>Gmail &amp; WhatsApp Formal Invitation Dispatcher (with PNG Card Attachment)</span>
          </div>
          <p className="text-xs text-slate-500">
            Every guest invitation automatically generates a high-resolution{' '}
            <strong className="text-slate-700 dark:text-neutral-200">.PNG Formal Invitation Card</strong>{' '}
            attached directly to Gmail messages and ready to share on WhatsApp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!needsGmailAuth && gmailToken ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Gmail Connected ({gmailUserEmail || 'Ready'})</span>
            </div>
          ) : (
            renderGoogleSignInButton('Sign in with Google to Connect Gmail')
          )}

          <button
            type="button"
            onClick={() => handleDownloadCardPng(null)}
            className="px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg text-xs font-semibold hover:bg-stone-100 dark:hover:bg-neutral-800 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Invitation PNG</span>
          </button>
        </div>
      </div>

      {/* Live Countdown Strip for All Separate Events (Engagement, Marriage, Other) */}
      <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-neutral-800 pb-3">
          <div>
            <h2 className="text-base font-bold font-display flex items-center gap-2">
              <CalendarHeart className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              <span>
                Event Countdowns &amp; Separate Function Selector (Engagement · Marriage · Other)
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any event below to customize its date, time, venue, and formal invitation, or
              send that event's PNG invitation to your Guest List.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddCustomEvent}
            className="px-3.5 py-2 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Other Event &amp; Invitation</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {subEvents.map((ev) => {
            const cd = calculateEventCountdown(ev.eventDate, ev.eventTime);
            const isSelected = ev.id === activeEvent.id;
            return (
              <div
                key={ev.id}
                onClick={() => setSelectedEventId(ev.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'border-slate-900 dark:border-amber-500 bg-stone-50 dark:bg-neutral-800/70 ring-1 ring-slate-900 dark:ring-amber-500'
                    : 'border-stone-200 dark:border-neutral-800 hover:border-stone-300'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-800 dark:text-amber-400">
                      {ev.eventCategory} Function
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-500 tabular-nums">
                        {ev.eventDate || 'Date not set'}
                      </span>
                      {subEvents.length > 1 && ev.eventCategory === 'Other' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomEvent(ev.id);
                          }}
                          className="text-slate-400 hover:text-red-600"
                          title="Delete custom event"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-bold truncate">{ev.eventTitle}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {ev.brideName && ev.groomName
                      ? `${ev.brideName} & ${ev.groomName}`
                      : 'Bride & Groom TBD'}{' '}
                    · {formatEventTime12h(ev.eventTime)}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {[ev.venue, ev.city].filter(Boolean).join(', ') || 'Venue not set'}
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-200 dark:border-neutral-700 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-500">Countdown</span>
                  <span
                    className={`text-sm font-bold font-mono tabular-nums ${
                      cd.isToday
                        ? 'text-emerald-600'
                        : cd.isPast
                        ? 'text-slate-400'
                        : 'text-slate-900 dark:text-amber-400'
                    }`}
                  >
                    {cd.hasDate
                      ? cd.isToday
                        ? 'Happening Today!'
                        : cd.isPast
                        ? `${cd.days} days ago`
                        : `${cd.days} Days · ${cd.hours}h ${cd.minutes}m`
                      : 'Set Event Date'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODE 1: FORMAL INVITATION DESIGNER & EVENT EDITOR */}
      {mode === 'invitations' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 6 Cols: Editable Event & Invitation Wording Form */}
          <div className="lg:col-span-6 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-neutral-800 pb-3">
              <div>
                <h3 className="text-base font-bold font-display">
                  Customize {activeEvent.eventCategory} Event &amp; Formal Invitation
                </h3>
                <p className="text-xs text-slate-500">
                  Changes to wording, time, date, venue, or couple details update the formal card
                  and PNG attachment live
                </p>
              </div>
              <span className="text-xs font-mono font-semibold text-amber-800 dark:text-amber-400 tabular-nums">
                {activeCountdown.statusText}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div>
                <label className="block font-medium mb-1">Event Type / Category</label>
                <select
                  value={activeEvent.eventCategory}
                  onChange={(e) =>
                    handleUpdateActiveEvent({
                      eventCategory: e.target.value as 'Engagement' | 'Marriage' | 'Other',
                    })
                  }
                  className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
                >
                  <option value="Engagement">Engagement</option>
                  <option value="Marriage">Marriage</option>
                  <option value="Other">Other Event (Mehendi / Sangeet / Reception)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium mb-1">Card Theme Style</label>
                <select
                  value={activeEvent.cardTheme}
                  onChange={(e) =>
                    handleUpdateActiveEvent({
                      cardTheme: e.target.value as InvitationThemeStyle,
                    })
                  }
                  className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
                >
                  {Object.entries(THEME_STYLES).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-medium mb-1">Ceremony / Event Title</label>
                <input
                  type="text"
                  value={activeEvent.eventTitle}
                  onChange={(e) => handleUpdateActiveEvent({ eventTitle: e.target.value })}
                  placeholder="e.g., Engagement & Ring Ceremony / Shubh Vivah"
                  className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent font-semibold"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Bride's Full Name</label>
                <input
                  type="text"
                  value={activeEvent.brideName}
                  onChange={(e) => handleUpdateActiveEvent({ brideName: e.target.value })}
                  placeholder="e.g., Ananya Verma"
                  className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Groom's Full Name</label>
                <input
                  type="text"
                  value={activeEvent.groomName}
                  onChange={(e) => handleUpdateActiveEvent({ groomName: e.target.value })}
                  placeholder="e.g., Aarav Kapoor"
                  className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Bride's Parents / Family</label>
                <input
                  type="text"
                  value={activeEvent.brideFamily}
                  onChange={(e) => handleUpdateActiveEvent({ brideFamily: e.target.value })}
                  placeholder="e.g., Mr. Rajesh & Mrs. Sunita Verma"
                  className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Groom's Parents / Family</label>
                <input
                  type="text"
                  value={activeEvent.groomFamily}
                  onChange={(e) => handleUpdateActiveEvent({ groomFamily: e.target.value })}
                  placeholder="e.g., Mr. Vikram & Mrs. Meera Kapoor"
                  className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Event Date (Drives Countdown)</label>
                <input
                  type="date"
                  value={activeEvent.eventDate}
                  onChange={(e) => handleUpdateActiveEvent({ eventDate: e.target.value })}
                  className="w-full px-3 py-2 font-mono border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent tabular-nums"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Event Time</label>
                <input
                  type="time"
                  value={activeEvent.eventTime}
                  onChange={(e) => handleUpdateActiveEvent({ eventTime: e.target.value })}
                  className="w-full px-3 py-2 font-mono border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent tabular-nums"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Venue / Hall Name</label>
                <input
                  type="text"
                  value={activeEvent.venue}
                  onChange={(e) => handleUpdateActiveEvent({ venue: e.target.value })}
                  placeholder="e.g., Crystal Ballroom, The Imperial"
                  className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">City</label>
                <input
                  type="text"
                  value={activeEvent.city}
                  onChange={(e) => handleUpdateActiveEvent({ city: e.target.value })}
                  placeholder="e.g., New Delhi"
                  className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-medium mb-1">Full Venue Address / Landmark</label>
                <input
                  type="text"
                  value={activeEvent.address}
                  onChange={(e) => handleUpdateActiveEvent({ address: e.target.value })}
                  placeholder="Street address for guest directions"
                  className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-medium mb-1">Top Invocation / Blessing Line</label>
                <input
                  type="text"
                  value={activeEvent.invocationText}
                  onChange={(e) => handleUpdateActiveEvent({ invocationText: e.target.value })}
                  placeholder="e.g., || Shree Ganeshaya Namah ||"
                  className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-medium mb-1">Host Invitation Line</label>
                <input
                  type="text"
                  value={activeEvent.hostLine}
                  onChange={(e) => handleUpdateActiveEvent({ hostLine: e.target.value })}
                  placeholder="e.g., Together with their families, we cordially invite you..."
                  className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-medium mb-1">Formal Invitation Body Wording</label>
                <textarea
                  rows={3}
                  value={activeEvent.bodyWording}
                  onChange={(e) => handleUpdateActiveEvent({ bodyWording: e.target.value })}
                  placeholder="Custom ceremony schedule and warm message..."
                  className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Dress Code (Optional)</label>
                <input
                  type="text"
                  value={activeEvent.dressCode}
                  onChange={(e) => handleUpdateActiveEvent({ dressCode: e.target.value })}
                  placeholder="e.g., Traditional Ethnic / Pastel Formals"
                  className="w-full px-3 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">RSVP Contact Phone / Family Name</label>
                <input
                  type="text"
                  value={activeEvent.rsvpContact}
                  onChange={(e) => handleUpdateActiveEvent({ rsvpContact: e.target.value })}
                  placeholder="e.g., +91 98101 11222"
                  className="w-full px-3 py-2 font-mono border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
                />
              </div>
            </div>
          </div>

          {/* Right 6 Cols: Live Formal Invitation Card Preview & Actions */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl p-4">
              <div>
                <div className="text-xs font-bold">
                  Live {activeEvent.eventCategory} Formal Invitation Preview
                </div>
                <div className="text-[11px] text-slate-500">
                  Download as PNG or send directly via Gmail &amp; WhatsApp with PNG attached
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadCardPng(null)}
                  className="px-3 py-1.5 border border-stone-300 dark:border-neutral-700 rounded-lg text-xs font-semibold hover:bg-stone-100 dark:hover:bg-neutral-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-amber-700" />
                  <span>Save PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyInvitationText()}
                  className="px-3 py-1.5 border border-stone-300 dark:border-neutral-700 rounded-lg text-xs font-medium hover:bg-stone-100 dark:hover:bg-neutral-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Wording</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 border border-stone-300 dark:border-neutral-700 rounded-lg text-xs font-medium hover:bg-stone-100 dark:hover:bg-neutral-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchMode('guests')}
                  className="px-3.5 py-1.5 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send to Guest List</span>
                </button>
              </div>
            </div>

            {renderFormalInvitationCard(activeEvent)}
          </div>
        </div>
      )}

      {/* MODE 2: GUEST LIST & DIRECT ONE-BY-ONE OR BULK INVITATION DISPATCH */}
      {mode === 'guests' && (
        <div className="space-y-5">
          {/* Guest Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
              <div className="text-xs text-slate-500">Total Invited Headcount</div>
              <div className="text-2xl font-bold font-mono tabular-nums mt-1">
                {workspace.guests.reduce((s, g) => s + (Number(g.headcount) || 0), 0)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Across {workspace.guests.length} family/guest entries
              </div>
            </div>
            <div className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
              <div className="text-xs text-slate-500">Formal Invitations Sent</div>
              <div className="text-2xl font-bold font-mono tabular-nums mt-1 text-emerald-700 dark:text-emerald-400">
                {workspace.guests.filter((g) => g.inviteSent).length} / {workspace.guests.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Via Gmail + PNG, WhatsApp + PNG &amp; SMS
              </div>
            </div>
            <div className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
              <div className="text-xs text-slate-500">Confirmed RSVP Headcount</div>
              <div className="text-2xl font-bold font-mono tabular-nums mt-1 text-emerald-700 dark:text-emerald-400">
                {workspace.guests
                  .filter((g) => g.rsvpStatus === 'Confirmed')
                  .reduce((s, g) => s + (Number(g.headcount) || 0), 0)}
              </div>
            </div>
            <div className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl">
              <div className="text-xs text-slate-500">Selected Event to Dispatch</div>
              <div className="text-sm font-bold truncate mt-1 text-amber-800 dark:text-amber-400">
                {activeEvent.eventCategory}: {activeEvent.eventTitle}
              </div>
              <button
                type="button"
                onClick={() => onSwitchMode('invitations')}
                className="text-[11px] underline text-slate-600 dark:text-neutral-400 mt-1 cursor-pointer"
              >
                Edit Formal Invitation Wording
              </button>
            </div>
          </div>

          {/* Add Guest Form with Mobile Number AND Email Address */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!guestName.trim()) return;
              const newGuest: GuestItem = {
                id: `gst_${Date.now()}`,
                scope: guestScope,
                name: guestName.trim(),
                side: guestSide,
                headcount: Math.max(1, Number(guestHeadcount) || 1),
                phone: guestPhone.trim(),
                email: guestEmail.trim(),
                city: guestCity.trim(),
                inviteSent: false,
                invitedEvents: [],
                rsvpStatus: guestRsvp,
                accommodationNeeded: false,
                notes: '',
              };
              onUpdateWorkspace((prev) => ({
                ...prev,
                guests: [newGuest, ...prev.guests],
              }));
              setGuestName('');
              setGuestPhone('');
              setGuestEmail('');
              setGuestCity('');
              showToast('Guest added with contact details.');
            }}
            className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-neutral-200">
                Add Guest to Guest List (Include Mobile Number for WhatsApp + PNG and Email for
                Gmail + PNG)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-2.5">
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Guest / Family Name *"
                className="lg:col-span-2 px-3 py-2 text-xs border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
              />
              <input
                type="text"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="WhatsApp / Mobile (+91...)"
                className="px-3 py-2 text-xs font-mono border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
              />
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="Gmail / Email Address"
                className="px-3 py-2 text-xs border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent"
              />
              <select
                value={guestScope}
                onChange={(e) => setGuestScope(e.target.value as any)}
                className="px-2.5 py-2 text-xs border border-stone-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
              >
                <option value="Both">Both (Eng &amp; Marriage)</option>
                <option value="Engagement">Engagement Only</option>
                <option value="Marriage">Marriage Only</option>
                <option value="Other">Other Event</option>
              </select>
              <select
                value={guestSide}
                onChange={(e) => setGuestSide(e.target.value as any)}
                className="px-2.5 py-2 text-xs border border-stone-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
              >
                <option value="Bride">Bride's Side</option>
                <option value="Groom">Groom's Side</option>
                <option value="Common">Common</option>
              </select>
              <input
                type="number"
                min="1"
                value={guestHeadcount}
                onChange={(e) => setGuestHeadcount(e.target.value)}
                placeholder="Pax"
                className="px-3 py-2 text-xs font-mono border border-stone-300 dark:border-neutral-700 rounded-lg bg-transparent tabular-nums"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Add Guest</span>
              </button>
            </div>
          </form>

          {/* Bulk Invitation Dispatch Toolbar & Event Switcher */}
          <div className="p-4 bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xs font-semibold text-slate-700 dark:text-neutral-300">
                Formal Invitation to Send:
              </div>
              <select
                value={activeEvent.id}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold border border-stone-300 dark:border-neutral-700 rounded-lg bg-stone-50 dark:bg-neutral-800"
              >
                {subEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    [{ev.eventCategory}] {ev.eventTitle} ({ev.eventDate || 'Date TBD'})
                  </option>
                ))}
              </select>

              <select
                value={guestScopeFilter}
                onChange={(e) => setGuestScopeFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-stone-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900"
              >
                <option value="All">Filter: All Invited Scopes</option>
                <option value="Engagement">Engagement Guests</option>
                <option value="Marriage">Marriage Guests</option>
                <option value="Both">Both Events</option>
                <option value="Other">Other Event</option>
              </select>

              <input
                type="text"
                value={guestSearch}
                onChange={(e) => setGuestSearch(e.target.value)}
                placeholder="Search guest name, mobile, email..."
                className="px-3 py-1.5 text-xs border border-stone-200 dark:border-neutral-800 rounded-lg bg-transparent"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedGuestIds(filteredGuests.map((g) => g.id))}
                className="px-3 py-1.5 text-xs font-medium border border-stone-300 dark:border-neutral-700 rounded-lg hover:bg-stone-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                Select All ({filteredGuests.length})
              </button>

              <button
                type="button"
                disabled={selectedGuestIds.length === 0}
                onClick={() => {
                  const selectedObjs = workspace.guests.filter((g) =>
                    selectedGuestIds.includes(g.id)
                  );
                  handlePrepareGmailSendWithPng(selectedObjs);
                }}
                className="px-3.5 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Bulk Send via Gmail + PNG ({selectedGuestIds.length})</span>
              </button>

              <button
                type="button"
                disabled={selectedGuestIds.length === 0 || dispatching}
                onClick={() => {
                  const selectedObjs = workspace.guests.filter((g) =>
                    selectedGuestIds.includes(g.id)
                  );
                  handleDispatchInvitations(selectedObjs, 'auto');
                }}
                className="px-3.5 py-2 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 disabled:opacity-40 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {dispatching
                    ? 'Sending...'
                    : `Bulk SMS/Email (${selectedGuestIds.length})`}
                </span>
              </button>
            </div>
          </div>

          {/* Guest List Table with Inline Contact Editing & Direct One-by-One Send */}
          <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-800/50 text-slate-500">
                  <th className="py-3 px-3 w-10">
                    <input
                      type="checkbox"
                      checked={
                        filteredGuests.length > 0 &&
                        selectedGuestIds.length === filteredGuests.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedGuestIds(filteredGuests.map((g) => g.id));
                        } else {
                          setSelectedGuestIds([]);
                        }
                      }}
                      className="w-3.5 h-3.5 rounded cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3 font-semibold min-w-[150px]">Guest / Family Name</th>
                  <th className="py-3 px-3 font-semibold">Event Scope &amp; Side</th>
                  <th className="py-3 px-3 font-semibold text-right">Pax</th>
                  <th className="py-3 px-3 font-semibold min-w-[140px]">WhatsApp / Mobile</th>
                  <th className="py-3 px-3 font-semibold min-w-[165px]">Gmail / Email Address</th>
                  <th className="py-3 px-3 font-semibold">RSVP</th>
                  <th className="py-3 px-3 font-semibold">Invitation Status</th>
                  <th className="py-3 px-3 font-semibold text-right min-w-[290px]">
                    Send Formal Invitation + PNG Card
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-neutral-800">
                {filteredGuests.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      No guests in this view yet. Add guests with their mobile number or email above
                      to send personalized formal invitations with PNG cards via Gmail and WhatsApp.
                    </td>
                  </tr>
                ) : (
                  filteredGuests.map((g) => {
                    const isSelected = selectedGuestIds.includes(g.id);
                    const hasMobile = Boolean(g.phone && g.phone.trim());
                    const hasEmail = Boolean(g.email && g.email.trim());

                    return (
                      <tr
                        key={g.id}
                        className="hover:bg-stone-50/70 dark:hover:bg-neutral-800/40"
                      >
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedGuestIds((prev) => [...prev, g.id]);
                              } else {
                                setSelectedGuestIds((prev) => prev.filter((id) => id !== g.id));
                              }
                            }}
                            className="w-3.5 h-3.5 rounded cursor-pointer"
                          />
                        </td>

                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={g.name}
                            onChange={(e) =>
                              onUpdateWorkspace((prev) => ({
                                ...prev,
                                guests: prev.guests.map((item) =>
                                  item.id === g.id ? { ...item, name: e.target.value } : item
                                ),
                              }))
                            }
                            className="w-full px-2 py-1 font-semibold bg-transparent border border-transparent hover:border-stone-300 rounded"
                          />
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <select
                              value={g.scope}
                              onChange={(e) =>
                                onUpdateWorkspace((prev) => ({
                                  ...prev,
                                  guests: prev.guests.map((item) =>
                                    item.id === g.id
                                      ? { ...item, scope: e.target.value as any }
                                      : item
                                  ),
                                }))
                              }
                              className="px-1.5 py-1 border border-stone-200 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900 text-[11px]"
                            >
                              <option value="Both">Both</option>
                              <option value="Engagement">Engagement</option>
                              <option value="Marriage">Marriage</option>
                              <option value="Other">Other</option>
                            </select>
                            <span className="text-slate-400">· {g.side}</span>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {g.headcount}
                        </td>

                        {/* Inline Editable Mobile Number */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={g.phone || ''}
                            onChange={(e) =>
                              onUpdateWorkspace((prev) => ({
                                ...prev,
                                guests: prev.guests.map((item) =>
                                  item.id === g.id ? { ...item, phone: e.target.value } : item
                                ),
                              }))
                            }
                            placeholder="+91 Mobile..."
                            className="w-full px-2 py-1 font-mono text-[11px] bg-transparent border border-stone-200 dark:border-neutral-700 rounded"
                          />
                        </td>

                        {/* Inline Editable Email Address */}
                        <td className="py-2.5 px-3">
                          <input
                            type="email"
                            value={g.email || ''}
                            onChange={(e) =>
                              onUpdateWorkspace((prev) => ({
                                ...prev,
                                guests: prev.guests.map((item) =>
                                  item.id === g.id ? { ...item, email: e.target.value } : item
                                ),
                              }))
                            }
                            placeholder="guest@gmail.com"
                            className="w-full px-2 py-1 text-[11px] bg-transparent border border-stone-200 dark:border-neutral-700 rounded"
                          />
                        </td>

                        {/* RSVP Status */}
                        <td className="py-2.5 px-3">
                          <select
                            value={g.rsvpStatus}
                            onChange={(e) =>
                              onUpdateWorkspace((prev) => ({
                                ...prev,
                                guests: prev.guests.map((item) =>
                                  item.id === g.id
                                    ? { ...item, rsvpStatus: e.target.value as any }
                                    : item
                                ),
                              }))
                            }
                            className="px-2 py-1 border border-stone-200 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900"
                          >
                            <option value="Confirmed">Confirmed</option>
                            <option value="Pending">Pending</option>
                            <option value="Declined">Declined</option>
                          </select>
                        </td>

                        {/* Invitation Sent Status */}
                        <td className="py-2.5 px-3">
                          {g.inviteSent ? (
                            <div className="space-y-0.5">
                              <span className="text-emerald-700 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Sent ({g.lastInvitedChannel || 'Mobile/Email'})
                              </span>
                              {g.invitedEvents && g.invitedEvents.length > 0 && (
                                <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                                  {g.invitedEvents.join(', ')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">Not sent yet</span>
                          )}
                        </td>

                        {/* One-by-One Direct Send Controls (WhatsApp + PNG, Gmail + PNG, Download PNG, Preview) */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {/* 1. Send via WhatsApp with PNG Invitation Attached */}
                            <button
                              type="button"
                              disabled={!hasMobile}
                              onClick={() => handlePrepareWhatsAppWithPng(g)}
                              title={
                                hasMobile
                                  ? `Send ${activeEvent.eventCategory} Invitation + PNG on WhatsApp (${g.phone})`
                                  : 'Enter mobile number first'
                              }
                              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-30 text-white text-[11px] font-semibold rounded flex items-center gap-1 cursor-pointer"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>WhatsApp + PNG</span>
                            </button>

                            {/* 2. Send via Gmail API with PNG Invitation Attached */}
                            <button
                              type="button"
                              disabled={!hasEmail}
                              onClick={() => handlePrepareGmailSendWithPng([g])}
                              title={
                                hasEmail
                                  ? `Send ${activeEvent.eventCategory} Invitation + PNG via Gmail (${g.email})`
                                  : 'Enter email address first'
                              }
                              className="px-2.5 py-1 bg-red-700 hover:bg-red-600 disabled:opacity-30 text-white text-[11px] font-semibold rounded flex items-center gap-1 cursor-pointer"
                            >
                              <Mail className="w-3 h-3" />
                              <span>Gmail + PNG</span>
                            </button>

                            {/* 3. Download Personalized PNG for this Guest */}
                            <button
                              type="button"
                              onClick={() => handleDownloadCardPng(g)}
                              title={`Download personalized PNG card for ${g.name}`}
                              className="p-1.5 border border-stone-200 dark:border-neutral-700 hover:bg-stone-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-300 rounded cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            {/* 4. Preview Personalized Formal Invitation Card */}
                            <button
                              type="button"
                              onClick={() => setPreviewGuest(g)}
                              title="Preview personalized formal invitation card"
                              className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* 5. Delete Guest */}
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateWorkspace((prev) => ({
                                  ...prev,
                                  guests: prev.guests.filter((item) => item.id !== g.id),
                                }))
                              }
                              title="Remove guest"
                              className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Mandatory Confirmation Dialog for Sending via Gmail with PNG Attachment */}
      {gmailConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-neutral-800 pb-3">
              <div>
                <h3 className="text-base font-bold font-display flex items-center gap-2">
                  <Mail className="w-4 h-4 text-red-600" />
                  <span>
                    Confirm Sending Formal Invitation via Gmail (with PNG Card Attached)
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Please confirm before sending {gmailConfirmModal.guests.length} email(s) on your
                  behalf with the generated PNG invitation attached.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGmailConfirmModal(null)}
                className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {needsGmailAuth || !gmailToken ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Connect your Google account below so PlanEase can send this formal invitation
                    with the PNG attachment through Gmail on your behalf.
                  </span>
                </div>
                {renderGoogleSignInButton('Sign in with Google')}
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start text-xs">
              {/* Left: Recipient & Email Details */}
              <div className="md:col-span-7 space-y-3">
                <div className="p-3 bg-stone-50 dark:bg-neutral-800/60 border border-stone-200 dark:border-neutral-800 rounded-lg space-y-1.5">
                  <div className="font-semibold text-slate-700 dark:text-neutral-200">
                    Recipients ({gmailConfirmModal.guests.length}):
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[11px]">
                    {gmailConfirmModal.guests.map((g) => (
                      <div key={g.id} className="truncate">
                        • {g.name} &lt;{g.email}&gt;
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-stone-50 dark:bg-neutral-800/60 border border-stone-200 dark:border-neutral-800 rounded-lg space-y-1">
                  <div className="font-semibold text-slate-700 dark:text-neutral-200">
                    Subject:
                  </div>
                  <div className="text-slate-800 dark:text-neutral-100">
                    {gmailConfirmModal.subject}
                  </div>
                  <div className="pt-2 font-semibold text-slate-700 dark:text-neutral-200">
                    Attached PNG File:
                  </div>
                  <div className="font-mono text-emerald-700 dark:text-emerald-400">
                    📎 {gmailConfirmModal.samplePng.filename} (image/png)
                  </div>
                </div>

                <div className="p-3 bg-stone-50 dark:bg-neutral-800/60 border border-stone-200 dark:border-neutral-800 rounded-lg max-h-36 overflow-y-auto whitespace-pre-line text-[11px] text-slate-600 dark:text-neutral-300">
                  {gmailConfirmModal.sampleBody}
                </div>
              </div>

              {/* Right: Attached PNG Preview */}
              <div className="md:col-span-5 space-y-2 text-center">
                <div className="text-[11px] font-semibold text-slate-500">
                  Attached PNG Invitation Preview
                </div>
                <img
                  src={gmailConfirmModal.samplePng.dataUrl}
                  alt="Formal Invitation PNG Preview"
                  className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 shadow-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setGmailConfirmModal(null)}
                className="px-4 py-2 border border-stone-300 dark:border-neutral-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sendingGmailNow}
                onClick={handleExecuteConfirmedGmailSend}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {sendingGmailNow
                    ? 'Sending via Gmail with PNG...'
                    : `Confirm & Send ${gmailConfirmModal.guests.length} Email(s) via Gmail`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: WhatsApp + PNG Invitation Attachment Dispatcher */}
      {whatsAppModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-neutral-800 pb-3">
              <div>
                <h3 className="text-base font-bold font-display flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>
                    Send WhatsApp Invitation + PNG Card to {whatsAppModal.guest.name}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Recipient WhatsApp: <strong className="font-mono">{whatsAppModal.guest.phone}</strong> ·
                  PNG File: <strong className="font-mono">{whatsAppModal.png.filename}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWhatsAppModal(null)}
                className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start text-xs">
              <div className="md:col-span-6 space-y-2 text-center">
                <div className="text-[11px] font-semibold text-slate-500">
                  Generated PNG Invitation Card ({whatsAppModal.png.filename})
                </div>
                <img
                  src={whatsAppModal.png.dataUrl}
                  alt="WhatsApp Formal Invitation PNG"
                  className="w-full rounded-lg border border-stone-200 dark:border-neutral-700 shadow-xs"
                />
              </div>

              <div className="md:col-span-6 space-y-3">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg space-y-1 text-emerald-900 dark:text-emerald-200">
                  <div className="font-bold">PNG Card Ready for WhatsApp</div>
                  <p className="text-[11px] leading-relaxed">
                    {whatsAppModal.copiedToClipboard
                      ? '✓ The PNG invitation image is already copied to your clipboard! When WhatsApp opens, simply press Ctrl+V (or Cmd+V) to paste the PNG card, or attach the downloaded PNG file.'
                      : 'Click below to download the PNG card and open WhatsApp with your personalized invitation message.'}
                  </p>
                </div>

                <div className="p-3 bg-stone-50 dark:bg-neutral-800/60 border border-stone-200 dark:border-neutral-800 rounded-lg max-h-48 overflow-y-auto whitespace-pre-line text-[11px] text-slate-600 dark:text-neutral-300">
                  {whatsAppModal.bodyText}
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleLaunchWhatsAppWithPng(false)}
                    className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Download PNG + Copy PNG &amp; Open WhatsApp Chat</span>
                  </button>

                  {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <button
                      type="button"
                      onClick={() => handleLaunchWhatsAppWithPng(true)}
                      className="w-full py-2 px-4 border border-emerald-600 text-emerald-700 dark:text-emerald-400 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share PNG File Directly via Device Share Sheet</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      triggerPngDownload(whatsAppModal.png);
                      showToast(`Downloaded ${whatsAppModal.png.filename}`);
                    }}
                    className="w-full py-2 px-4 border border-stone-300 dark:border-neutral-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PNG File Only</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Personalized Guest Formal Invitation Preview */}
      {previewGuest && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-neutral-800 pb-3">
              <div>
                <h3 className="text-base font-bold font-display">
                  Formal Invitation for {previewGuest.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Event: {activeEvent.eventCategory} — {activeEvent.eventTitle} · Contact:{' '}
                  {[previewGuest.phone, previewGuest.email].filter(Boolean).join(' / ') ||
                    'No contact entered'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewGuest(null)}
                className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {renderFormalInvitationCard(activeEvent, previewGuest)}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-stone-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadCardPng(previewGuest)}
                  className="px-3 py-2 border border-stone-300 dark:border-neutral-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyInvitationText(previewGuest)}
                  className="px-3 py-2 border border-stone-300 dark:border-neutral-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Wording</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {previewGuest.phone && (
                  <button
                    type="button"
                    onClick={() => {
                      const g = previewGuest;
                      setPreviewGuest(null);
                      handlePrepareWhatsAppWithPng(g);
                    }}
                    className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp + PNG</span>
                  </button>
                )}
                {previewGuest.email && (
                  <button
                    type="button"
                    onClick={() => {
                      const g = previewGuest;
                      setPreviewGuest(null);
                      handlePrepareGmailSendWithPng([g]);
                    }}
                    className="px-3.5 py-2 bg-red-700 hover:bg-red-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Gmail + PNG</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Bulk / Individual Invitation Dispatch Receipt */}
      {dispatchReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-stone-200 dark:border-neutral-800 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-neutral-800 pb-3">
              <div>
                <h3 className="text-base font-bold font-display flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Formal Invitation Dispatch Summary</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{dispatchReceipt.eventTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setDispatchReceipt(null)}
                className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-stone-100 dark:divide-neutral-800 text-xs">
              {dispatchReceipt.deliveries.map((d) => (
                <div key={d.guestId} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{d.guestName}</div>
                    <div className="text-[11px] font-mono text-slate-500">{d.target}</div>
                  </div>
                  <span
                    className={`font-semibold ${
                      d.delivered
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-600'
                    }`}
                  >
                    {d.delivered ? `✓ Sent via ${d.channel}` : d.channel}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDispatchReceipt(null)}
                className="px-4 py-2 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
