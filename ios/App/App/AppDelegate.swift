import UIKit
import Capacitor
import Contacts
import ContactsUI

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// MARK: - ContactViewer plugin
//
// Presents the native contact card (CNContactViewController) for a linked
// iPhone contact. iOS has no public URL scheme to open Contacts.app to a
// specific person, so we show Apple's own contact UI inside Membr instead —
// same view/edit experience as the Contacts app. Defined here (an already-
// compiled file) and auto-registered via CAPBridgedPlugin, so no new Xcode
// project files or registration boilerplate are needed.
@objc(ContactViewerPlugin)
public class ContactViewerPlugin: CAPPlugin, CAPBridgedPlugin, CNContactViewControllerDelegate {
    public let identifier = "ContactViewerPlugin"
    public let jsName = "ContactViewer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openContact", returnType: CAPPluginReturnPromise)
    ]

    @objc func openContact(_ call: CAPPluginCall) {
        guard let contactId = call.getString("contactId"), !contactId.isEmpty else {
            call.reject("Missing contactId")
            return
        }
        let store = CNContactStore()
        let keys = [CNContactViewController.descriptorForRequiredKeys()]
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let contact = try store.unifiedContact(withIdentifier: contactId, keysToFetch: keys)
                DispatchQueue.main.async {
                    let vc = CNContactViewController(for: contact)
                    vc.delegate = self
                    vc.allowsEditing = true
                    vc.allowsActions = true
                    let nav = UINavigationController(rootViewController: vc)
                    vc.navigationItem.leftBarButtonItem = UIBarButtonItem(
                        barButtonSystemItem: .done,
                        target: self,
                        action: #selector(self.dismissContact)
                    )
                    self.bridge?.viewController?.present(nav, animated: true)
                    call.resolve()
                }
            } catch {
                DispatchQueue.main.async { call.reject("Contact not found") }
            }
        }
    }

    @objc func dismissContact() {
        DispatchQueue.main.async {
            self.bridge?.viewController?.presentedViewController?.dismiss(animated: true)
        }
    }

    public func contactViewController(_ viewController: CNContactViewController, didCompleteWith contact: CNContact?) {
        viewController.dismiss(animated: true)
    }
}
