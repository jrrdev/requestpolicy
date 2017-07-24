# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from rp_puppeteer.base import BaseLib
from firefox_puppeteer.api.appinfo import AppInfo
from firefox_puppeteer.api.utils import Utils
import time


class SubscriptionsSettings(BaseLib):

    def __init__(self, marionette_getter):
        BaseLib.__init__(self, marionette_getter)

        self.app_info = AppInfo(marionette_getter)
        self.utils = Utils(marionette_getter)

    #################################
    # Public Properties and Methods #
    #################################

    def open(self):
        self.marionette.navigate("about:requestpolicy?subscriptions")

    def enable(self, subscription_name):
        if not self.is_enabled(subscription_name):
            self.toggle(subscription_name)

    def disable(self, subscription_name):
        if self.is_enabled(subscription_name):
            self.toggle(subscription_name)

    def is_enabled(self, subscription_name):
        if self.utils.compare_version(self.app_info.version, "49") < 0:
            # up to Firefox 48 (Bug 1272653)
            return self._get(subscription_name).get_attribute("checked")
        return self._get(subscription_name).get_property("checked")

    def toggle(self, subscription_name):
        self._get(subscription_name).click()
        # Wait for the subscriptions to be ready.
        # FIXME: Use API for detection, as soon as there is such an API.
        time.sleep(1)

    def enable_all(self):
        for name in self.AVAILABLE_SUBSCRIPTIONS:
            self.enable(name)

    def disable_all(self):
        for name in self.AVAILABLE_SUBSCRIPTIONS:
            self.disable(name)

    ##################################
    # Private Properties and Methods #
    ##################################

    AVAILABLE_SUBSCRIPTIONS = [
        "allow_embedded", "allow_extensions", "allow_functionality",
        "allow_mozilla", "allow_sameorg", "deny_trackers"
    ]

    def _get(self, subscription_name):
        return (self.marionette
                .find_element("css selector",
                              "input[name={}]".format(subscription_name)))
