const WA_BOT_URL = "https://wa.me/6287776660466?text=halo";

/** FAB WhatsApp — jalur tercepat ke bot dari halaman web mana pun. */
export function WaFab() {
  return (
    <a
      href={WA_BOT_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat Kopra di WhatsApp"
      title="Chat Kopra di WhatsApp"
      className="fixed right-5 bottom-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
    >
      <svg viewBox="0 0 32 32" fill="currentColor" className="h-8 w-8" aria-hidden="true">
        <path d="M16.004 4c-6.627 0-12 5.373-12 12 0 2.116.55 4.184 1.595 6.007L4 28l6.153-1.575A11.94 11.94 0 0 0 16.004 28c6.627 0 12-5.373 12-12s-5.373-12-12-12Zm0 21.82a9.79 9.79 0 0 1-4.99-1.364l-.358-.213-3.652.935.975-3.564-.233-.366a9.77 9.77 0 0 1-1.51-5.248c0-5.417 4.407-9.824 9.824-9.824 5.416 0 9.823 4.407 9.823 9.824 0 5.416-4.407 9.82-9.879 9.82Zm5.387-7.355c-.295-.148-1.746-.861-2.016-.96-.27-.098-.467-.147-.664.148-.196.295-.762.96-.934 1.157-.172.196-.344.221-.639.073-.295-.147-1.246-.459-2.373-1.464-.877-.782-1.469-1.748-1.641-2.043-.172-.295-.019-.455.129-.602.133-.132.295-.344.443-.516.147-.172.196-.295.295-.492.098-.196.049-.369-.025-.516-.074-.147-.664-1.6-.91-2.19-.24-.576-.483-.498-.664-.507l-.566-.01c-.196 0-.516.074-.786.369-.27.295-1.032 1.008-1.032 2.46 0 1.451 1.057 2.853 1.204 3.05.147.196 2.08 3.176 5.039 4.453.704.304 1.254.486 1.682.622.707.225 1.35.193 1.859.117.567-.085 1.746-.714 1.992-1.403.246-.69.246-1.28.172-1.403-.073-.123-.27-.196-.565-.344Z" />
      </svg>
    </a>
  );
}
