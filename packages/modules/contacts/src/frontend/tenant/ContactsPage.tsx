import { ContactsPageView } from "./components/ContactsPageView.js";
import { useContactsPageController } from "./hooks/useContactsPageController.js";

function ContactsInner() {
  const view = useContactsPageController();
  return <ContactsPageView {...view} />;
}

export default ContactsInner;
