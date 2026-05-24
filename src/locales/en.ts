export default 
{
  "app": {
    "name": "Concertivo",
    "tagline": "Concert and music organization management system"
  },
  "nav": {
    "dashboard": "Dashboard",
    "organizations": "Organizations",
    "admin": "Admin panel",
    "approvals": "Approvals",
    "logout": "Log out",
    "login": "Sign in",
    "register": "Sign up"
  },
  "lang": {
    "label": "Language",
    "pl": "Polski",
    "en": "English"
  },
  "common": {
    "loading": "Loading…",
    "save": "Save",
    "cancel": "Cancel",
    "submit": "Submit",
    "back": "Back",
    "next": "Next",
    "approve": "Approve",
    "reject": "Reject",
    "edit": "Edit",
    "delete": "Delete",
    "search": "Search",
    "empty": "No data",
    "error": "Something went wrong",
    "success": "Done"
  },
  "landing": {
    "hero": {
      "title": "Manage concerts, bands and events in one place",
      "subtitle": "Concertivo is a platform for booking agencies, stage and event companies and musicians. Plan, coordinate and settle performances.",
      "cta_primary": "Get started",
      "cta_secondary": "I already have an account"
    }
  },
  "auth": {
    "login": {
      "title": "Sign in",
      "email": "Email address",
      "password": "Password",
      "submit": "Sign in",
      "forgot": "Forgot your password?",
      "no_account": "No account yet?",
      "register_link": "Create one"
    },
    "register": {
      "title": "Create your account",
      "step_account": "Account",
      "step_profile": "Profile",
      "step_kinds": "Who you are",
      "first_name": "First name",
      "last_name": "Last name",
      "phone": "Phone (optional)",
      "email": "Email address",
      "password": "Password",
      "password_confirm": "Confirm password",
      "kinds_help": "Pick all roles that describe you. You can change them later.",
      "submit": "Create account",
      "have_account": "Already have an account?",
      "login_link": "Sign in",
      "check_email": "Check your inbox — we've sent an activation link."
    },
    "reset": {
      "title": "Reset password",
      "request_subtitle": "Enter your email and we'll send a link to set a new password.",
      "set_subtitle": "Set a new password.",
      "email": "Email address",
      "new_password": "New password",
      "send": "Send link",
      "set": "Set password",
      "sent": "Sent. Check your inbox."
    },
    "errors": {
      "passwords_mismatch": "Passwords don't match",
      "weak_password": "Password must be at least 8 characters",
      "invalid_credentials": "Invalid email or password",
      "select_at_least_one_kind": "Select at least one role"
    }
  },
  "user_kinds": {
    "team_manager": "Band manager",
    "musician": "Musician",
    "sound_engineer": "Sound engineer",
    "lighting_engineer": "Lighting engineer",
    "visual_engineer": "Visual / VJ engineer",
    "driver": "Driver",
    "stage_technician": "Stage technician",
    "stage_company_owner": "Stage company owner",
    "event_company_owner": "Event company owner",
    "concert_organizer": "Concert organizer"
  },
  "organizations": {
    "title": "My organizations",
    "new": "Register organization",
    "empty": "You don't have any organizations yet. Register a band or company.",
    "type": {
      "label": "Organization type",
      "band": "Music band",
      "stage_company": "Stage company",
      "event_company": "Event company"
    },
    "status": {
      "label": "Status",
      "pending": "Pending approval",
      "approved": "Approved",
      "rejected": "Rejected"
    },
    "form": {
      "name": "Organization name",
      "description": "Description (optional)",
      "submit": "Submit for approval"
    },
    "members": {
      "title": "Members",
      "invite": "Invite",
      "email_placeholder": "email@example.com",
      "invitation_sent": "Invitation sent",
      "pending_invitations": "Pending invitations"
    },
    "messages": {
      "created": "Organization submitted. An admin will review it.",
      "approved": "Organization approved.",
      "rejected": "Organization rejected."
    }
  },
  "admin": {
    "approvals": {
      "title": "Organizations awaiting approval",
      "empty": "No pending approvals.",
      "created_by": "Submitted by:",
      "created_at": "Submitted at:"
    }
  }
} as const;
