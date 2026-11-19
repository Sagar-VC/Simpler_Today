// // /**
// //  * Single Ordered Test Suite
// //  *
// //  * Controls test execution sequence by importing spec files in the desired order.
// //  * Playwright registers tests in import order, ensuring consistent sequencing.
// //  *
// //  * Execution order:
// //  *   1.  Register New User
// //  *   2.  Login
// //  *   3.  Forgot Password
// //  *   4.  Workspace Add
// //  *   5.  Workspace Edit
// //  *   6.  Workspace Delete
// //  *   7.  Template Library
// //  *   8.  Template Library Edit
// //  *   9.  Template Library Delete
// //  *   10. Supporting Material
// //  *   11. List of Dates
// // //  */
 
import { test } from '@playwright/test';

// import './Login.spec';
// import './forgotpassword.spec';
// import './WorkspaceAdd.spec';
// import './WorkSpaceEdit.spec';
// import './WorkspaceDelete.spec';
// import './Supporting Material.spec'; //
// import './ListofDates.spec';

// ──────────────────────────────────────────────────────────────
// Master Admin files
// ──────────────────────────────────────────────────────────────
// These files declare test.use({ storageState }), beforeEach and afterEach at
// their top level. A static `import` would attach those to this file's root
// suite, so they would run for EVERY test above (Login, Workspace, ...).
// Loading each file inside its own describe keeps its session and hooks
// scoped to its own tests only. They run after the imports above, in this order.


test.describe('Master Admin - Login', () => { require('./Master_Admin/Master_Login_Page.spec'); });
test.describe('Master Admin - Users', () => { require('./Master_Admin/Users.spec'); });
test.describe('Master Admin - User View Actions', () => { require('./Master_Admin/User_View_action.spec'); });
test.describe('Master Admin - Template Actions', () => { require('./Master_Admin/templates_action.spec'); });
test.describe('Master Admin - Custom Template Edit', () => { require('./Master_Admin/master_customeTemplate_Edit.spec'); });
test.describe('Master Admin - Document Drafts Add', () => { require('./Master_Admin/master_DocumentDraftsadd.spec'); });
test.describe('Master Admin - Template Preview', () => { require('./Master_Admin/master_templatepreview.spec'); });
test.describe('Master Admin - Knowledge Base', () => { require('./Master_Admin/knowledge_base.spec'); }); // file is currently empty


// import './CustomeTemplate_Edit.spec';  // Done
// // The CustomerTemplateDelete.spec file is not present at this path.
// // import './CustomerTemplateDelete.spec';  // Done
// import './CustomerTemolate_Add.spec';  // Done
// import './DocumentDraftsadd.spec';  // Done
// import './CaseLaws.spec';
// import './ApplicableLaws.spec';
// import './TemplatePreview.spec';  //Done