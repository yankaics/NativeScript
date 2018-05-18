﻿// >> article-require-page-module
import { Page, ShownModallyData, NavigatedData } from "tns-core-modules/ui/page";
// FrameModule is needed in order to have an option to navigate to the new page.
import { topmost, NavigationEntry } from "tns-core-modules/ui/frame";
// << article-require-page-module

// TODO: Remove this and get it from global to decouple builder for angular
import { createViewFromEntry } from "tns-core-modules/ui/builder";

// >> article-set-bindingcontext
function pageLoaded(args) {
    const page = args.object;
    page.bindingContext = { name: "Some name" };
}
exports.pageLoaded = pageLoaded;
// << article-set-bindingcontext
import * as TKUnit from "../../TKUnit";
import * as helper from "../helper";
import { GridLayout } from "tns-core-modules/ui/layouts/grid-layout";
import { StackLayout } from "tns-core-modules/ui/layouts/stack-layout";
import { View, PercentLength, Observable, unsetValue, EventData, isIOS } from "tns-core-modules/ui/core/view";
import { Frame, stack } from "tns-core-modules/ui/frame";
import { Label } from "tns-core-modules/ui/label";
import { Color } from "tns-core-modules/color";
import { TabView, TabViewItem } from "tns-core-modules/ui/tab-view/tab-view";
import { _resetRootView, getRootView } from "tns-core-modules/application";
import { Button } from "tns-core-modules/ui/button/button";

export function addLabelToPage(page: Page, text?: string) {
    const label = new Label();
    label.text = text || "The quick brown fox jumps over the lazy dog.";
    page.content = label;
}

export function test_recycling() {
    helper.nativeView_recycling_test(() => new Page());
}

export function test_AfterPageLoaded_is_called_NativeInstance_is_created() {
    let page: Page;
    let label: Label;
    let nativeInstanceCreated = false;

    const handler = (data) => nativeInstanceCreated = !!label.nativeViewProtected;
    const pageFactory = () => {
        page = new Page();
        page.id = `page_test_AfterPageLoaded_is_called_NativeInstance_is_created`;
        page.on(Label.loadedEvent, handler);

        label = new Label();
        label.text = "Text";
        page.content = label;
        return page;
    };

    helper.navigate(pageFactory);

    TKUnit.assertTrue(nativeInstanceCreated, "nativeInstanceCreated");
    page.off(Label.loadedEvent, handler);
}

export function test_PageLoaded_is_called_once() {

    let page1: Page;
    let page2: Page;

    let loaded = 0;
    const handler = function (data) {
        loaded++;
    }

    const pageFactory = function (): Page {
        page1 = new Page();
        page1.id = `page1_test_PageLoaded_is_called_once`;
        addLabelToPage(page1, "Page 1");
        return page1;
    };

    helper.navigate(pageFactory);
    TKUnit.assertEqual(loaded, 0);

    const pageFactory2 = function (): Page {
        page2 = new Page();
        page2.id = `page2_test_PageLoaded_is_called_once`;
        addLabelToPage(page2, "Page 2");
        page2.on(Label.loadedEvent, handler);
        return page2;
    };

    helper.navigate(pageFactory2);

    TKUnit.assertEqual(loaded, 1);
    page2.off(Label.loadedEvent, handler);
}

export function test_NavigateToNewPage() {
    // >> article-create-navigate-to-page

    const topFrame = topmost();
    const currentPage = topFrame.currentPage;

    let testPage: Page;
    const pageFactory = function (): Page {
        testPage = new Page();
        const label = new Label();
        label.text = "The quick brown fox jumps over the lazy dog.";
        testPage.content = label;
        return testPage;
    };

    const navEntry = {
        create: pageFactory,
        animated: false
    };
    topFrame.navigate(navEntry);
    // << article-create-navigate-to-page

    TKUnit.waitUntilReady(() => testPage.isLayoutValid);

    // >> article-navigating-backward
    topFrame.goBack();
    // << article-navigating-backward

    TKUnit.waitUntilReady(() => topFrame.navigationQueueIsEmpty());
    TKUnit.assertNull(testPage.parent, "Page.parent should become undefined after navigating back");
    TKUnit.assertNull(testPage._context, "Page._context should become undefined after navigating back");
    TKUnit.assertFalse(testPage.isLoaded, "Page.isLoaded should become false after navigating back");
    TKUnit.assertNull(testPage.frame, "Page.frame should become undefined after navigating back");
    TKUnit.assertFalse(testPage._isAddedToNativeVisualTree, "Page._isAddedToNativeVisualTree should become false after navigating back");
}

export function test_PageNavigation_EventSequence_WithTransition() {
    _test_PageNavigation_EventSequence(true);
}

export function test_PageNavigation_EventSequence_WithoutTransition() {
    _test_PageNavigation_EventSequence(false);
}

function _test_PageNavigation_EventSequence(withTransition: boolean) {
    const context = { property: "this is the context" };
    const eventSequence = [];

    let testPage: Page;
    const pageFactory = () => {
        testPage = new Page();
        testPage.id = "testPage_test_PageNavigation_EventSequence";
        addLabelToPage(testPage);

        testPage.on(Page.navigatingToEvent, function (data: NavigatedData) {
            eventSequence.push("navigatingTo");
            TKUnit.assertEqual(data.context, context, "navigatingTo: navigationContext");
        });

        testPage.on(Page.loadedEvent, function (data: EventData) {
            eventSequence.push("loaded");
            TKUnit.assertNotEqual(topmost().currentPage, data.object);
        });

        testPage.on(Page.navigatedToEvent, function (data: NavigatedData) {
            eventSequence.push("navigatedTo");
            TKUnit.assertEqual(data.context, context, "navigatedTo : navigationContext");
            TKUnit.assertEqual(topmost().currentPage, data.object);
        });

        testPage.on(Page.navigatingFromEvent, function (data: NavigatedData) {
            eventSequence.push("navigatingFrom");
            TKUnit.assertEqual(data.context, context, "navigatingFrom: navigationContext");
        });

        testPage.on(Page.navigatedFromEvent, function (data: NavigatedData) {
            eventSequence.push("navigatedFrom");
            TKUnit.assertEqual(data.context, context, "navigatedFrom: navigationContext");
        });

        testPage.on(Page.unloadedEvent, function (data) {
            eventSequence.push("unloaded");
        });

        return testPage;
    };

    const navigationEntry: NavigationEntry = {
        create: pageFactory,
        context: context,
        animated: withTransition,
        transition: withTransition ? {
            name: "slide",
            duration: 10,
        } : undefined
    }

    helper.navigateWithEntry(navigationEntry);
    helper.goBack();

    const expectedEventSequence = ["navigatingTo", "loaded", "navigatedTo", "navigatingFrom", "unloaded", "navigatedFrom"];
    TKUnit.arrayAssert(eventSequence, expectedEventSequence, "Actual event sequence is not equal to expected. Actual: " + eventSequence + "; Expected: " + expectedEventSequence);
}

export function test_NavigateTo_WithContext() {
    const currentPage = topmost().currentPage;
    // >> article-pass-data
    let testPage: Page;
    const pageFactory = function (): Page {
        testPage = new Page();
        testPage.on(Page.navigatedToEvent, function () {
            //console.log(JSON.stringify(context));
        });
        return testPage;
    };

    const navEntry = {
        create: pageFactory,
        context: "myContext",
        animated: false
    };

    const topFrame = topmost();
    topFrame.navigate(navEntry);
    // << article-pass-data
    TKUnit.waitUntilReady(() => topFrame.navigationQueueIsEmpty());

    const actualContextValue = testPage.navigationContext;
    TKUnit.assertEqual(actualContextValue, "myContext");

    helper.goBack();
    TKUnit.assertNull(testPage.navigationContext, "Navigation context should be cleared on navigating back");
}

//https://github.com/NativeScript/NativeScript/issues/731
export function test_NavigateTo_WithBindingContext() {
    const currentPage = topmost().currentPage;
    let testPage: Page;
    let bindingContext;
    const pageFactory = function (): Page {
        testPage = new Page();
        testPage.on(Page.navigatingToEvent, function (args: NavigatedData) {
            bindingContext = (<Page>args.object).bindingContext;
        });
        return testPage;
    };

    const navEntry = {
        create: pageFactory,
        bindingContext: "bindng context",
        animated: false
    };

    const topFrame = topmost();
    topFrame.navigate(navEntry);
    TKUnit.waitUntilReady(() => topFrame.navigationQueueIsEmpty());
    helper.goBack();

    TKUnit.assertEqual(bindingContext, navEntry.bindingContext, "The Page's bindingContext should be equal to the NavigationEntry.bindingContext property when navigating to.");
}

export function test_FrameBackStack_WhenNavigatingForwardAndBack() {
    helper.navigate(() => new Page());
    let testPage: Page;
    const pageFactory = function () {
        testPage = new Page();
        testPage.id = "testPage_test_FrameBackStack_WhenNavigatingForwardAndBack";
        addLabelToPage(testPage);
        return testPage;
    };

    helper.navigateWithHistory(pageFactory);

    const topFrame = topmost();
    TKUnit.assertEqual(topFrame.backStack.length, 1);
    TKUnit.assertTrue(topFrame.canGoBack(), "topFrame.canGoBack() should be true");

    helper.goBack();

    TKUnit.assertEqual(topFrame.backStack.length, 0);
    TKUnit.assertFalse(topFrame.canGoBack(), "topFrame.canGoBack() should be false");
}

export function test_LoadPageFromModule() {
    const topFrame = topmost();
    helper.navigateToModule("ui/page/test-page-module");

    TKUnit.assert(topFrame.currentPage.content instanceof Label, "Content of the test page should be a Label created within test-page-module.");
    const testLabel = <Label>topFrame.currentPage.content;
    TKUnit.assertEqual(testLabel.text, "Label created within a page module.");
}

export function test_LoadPageFromDeclarativeWithCSS() {
    const topFrame = topmost();
    helper.navigateToModule("ui/page/test-page-declarative-css");

    TKUnit.assert(topFrame.currentPage.content instanceof Label, "Content of the test page should be a Label created within test-page-module-css.");
    const testLabel = <Label>topFrame.currentPage.content;
    TKUnit.assertEqual(testLabel.text, "Label created within a page declarative file with css.");
    TKUnit.assertEqual(testLabel.style.backgroundColor.hex, "#00FF00");
}

export function test_LoadPageFromModuleWithCSS() {
    const topFrame = topmost();
    helper.navigateToModule("ui/page/test-page-module-css");

    TKUnit.assert(topFrame.currentPage.content instanceof Label, "Content of the test page should be a Label created within test-page-module-css.");
    const testLabel = <Label>topFrame.currentPage.content;
    TKUnit.assertEqual(testLabel.text, "Label created within a page module css.");
    TKUnit.assertEqual(testLabel.style.backgroundColor.hex, "#00FF00");
}

export function test_NavigateToPageCreatedWithNavigationEntry() {
    const expectedText = "Label created with a NavigationEntry";
    let testPage: Page;
    const pageFactory = function () {
        testPage = new Page();
        testPage.id = "testPage_test_NavigateToPageCreatedWithNavigationEntry";
        addLabelToPage(testPage, expectedText);
        return testPage;
    };

    helper.navigate(pageFactory);

    const actualContent = <Label>testPage.content;
    TKUnit.assertEqual(actualContent.text, expectedText);
}

export function test_cssShouldBeAppliedToAllNestedElements() {
    const expectedText = "Some text";
    const testPage = new Page();
    testPage.id = "testPage_test_cssShouldBeAppliedToAllNestedElements";
    const label = new Label();
    label.text = expectedText;

    const stackLayout = new StackLayout();
    stackLayout.addChild(label);
    testPage.content = stackLayout;
    testPage.css = "stackLayout {background-color: #FFFF0000;} label {background-color: #FF00FF00;}";

    const pageFactory = function () {
        return testPage;
    };

    helper.navigate(pageFactory);

    TKUnit.assertEqual(label.style.backgroundColor.hex, "#00FF00");
    TKUnit.assertEqual(stackLayout.style.backgroundColor.hex, "#FF0000");
}

export function test_cssShouldBeAppliedAfterChangeToAllNestedElements() {
    const expectedText = "Some text";
    const testPage = new Page();
    testPage.id = "testPage_test_cssShouldBeAppliedAfterChangeToAllNestedElements";
    const label = new Label();
    label.text = expectedText;

    const stackLayout = new StackLayout();
    stackLayout.addChild(label);
    testPage.content = stackLayout;
    testPage.css = "stackLayout {background-color: #FFFF0000;} label {background-color: #FF00FF00;}";

    const pageFactory = function () {
        return testPage;
    };

    helper.navigate(pageFactory);

    TKUnit.assertEqual(label.style.backgroundColor.hex, "#00FF00");
    TKUnit.assertEqual(stackLayout.style.backgroundColor.hex, "#FF0000");

    testPage.css = "stackLayout {background-color: #FF0000FF;} label {background-color: #FFFF0000;}";
    TKUnit.assertEqual(label.style.backgroundColor.hex, "#FF0000");
    TKUnit.assertEqual(stackLayout.style.backgroundColor.hex, "#0000FF");
}

export function test_page_backgroundColor_is_white() {
    const page = new Page();
    page.id = "page_test_page_backgroundColor_is_white";
    const factory = () => page;
    helper.navigate(factory);
    const whiteColor = new Color("white");
    if (isIOS) {
        TKUnit.assertTrue(whiteColor.ios.CGColor.isEqual(page.nativeViewProtected.backgroundColor.CGColor), "page default backgroundColor should be white");
    } else {
        TKUnit.assertEqual(page.nativeViewProtected.getBackground().getColor(), whiteColor.android, "page default backgroundColor should be white");
    }
}

export function test_WhenPageIsLoadedFrameCurrentPageIsNotYetTheSameAsThePage() {
    let page: Page;
    const loadedEventHandler = function (args) {
        TKUnit.assertNotEqual(topmost().currentPage, args.object, "When a page is loaded it should not yet be the current page.");
    }

    const pageFactory = function (): Page {
        page = new Page();
        page.id = "page_test_WhenPageIsLoadedFrameCurrentPageIsNotYetTheSameAsThePage";
        page.on(Label.loadedEvent, loadedEventHandler);
        const label = new Label();
        label.text = "Text";
        page.content = label;
        return page;
    };

    helper.navigate(pageFactory);
    page.off(Label.loadedEvent, loadedEventHandler);
}

export function test_WhenPageIsNavigatedToFrameCurrentPageIsNowTheSameAsThePage() {
    let page: Page;
    const navigatedEventHandler = function (args) {
        TKUnit.assertEqual(topmost().currentPage, args.object, `frame.topmost().currentPage should be equal to args.object page instance in the page.navigatedTo event handler. Expected: ${args.object.id}; Actual: ${topmost().currentPage.id};`);
    }

    const pageFactory = function (): Page {
        page = new Page();
        page.id = "page_test_WhenPageIsNavigatedToFrameCurrentPageIsNowTheSameAsThePage";
        page.on(Page.navigatedToEvent, navigatedEventHandler);
        const label = new Label();
        label.text = "Text";
        page.content = label;
        return page;
    };

    helper.navigate(pageFactory);
    page.off(Label.loadedEvent, navigatedEventHandler);
}

export function test_WhenInnerViewCallsCloseModal_WithArguments_ShouldPassResult() {
    _test_WhenInnerViewCallsCloseModal((args: ShownModallyData) =>
    {
        const page = <Page>args.object;
        const button = <Button>page.content;
        return button.closeModal.bind(button);
    }, "return value");
}

export function test_WhenInnerViewCallsCloseModal_WithoutArguments_ShouldWork() {
    _test_WhenInnerViewCallsCloseModal((args: ShownModallyData) =>
    {
        const page = <Page>args.object;
        const button = <Button>page.content;
        return button.closeModal.bind(button);
    });
}

export function test_WhenInnerViewCallsCloseCallback_WithArguments_ShouldPassResult() {
    _test_WhenInnerViewCallsCloseModal((args: ShownModallyData) =>
    {
        return args.closeCallback;
    }, "return value");
}

export function test_WhenInnerViewCallsCloseCallback_WithoutArguments_ShouldWork() {
    _test_WhenInnerViewCallsCloseModal((args: ShownModallyData) =>
    {
        return args.closeCallback;
    });
}

function _test_WhenInnerViewCallsCloseModal(closeModalGetter: (ShownModallyData) => Function, result?: any) {
    let modalClosedWithResult = false;

    const modalCloseCallback = function (returnValue: any) {
        modalClosedWithResult = returnValue === result;
    }

    const modalPageShownModallyEventHandler = function(args: ShownModallyData) {
        const page = <Page>args.object;
        page.off(View.shownModallyEvent, modalPageShownModallyEventHandler);
        
        closeModalGetter(args)(result);
    }

    const hostNavigatedToEventHandler = function(args: NavigatedData) {
        const page = <Page>args.object;
        page.off(Page.navigatedToEvent, hostNavigatedToEventHandler);

        const modalPage = new Page();
        modalPage.id = "modalPage_test_WhenInnerViewCallsCloseModal_WithArguments_ShouldPassResult";
        modalPage.on(View.shownModallyEvent, modalPageShownModallyEventHandler);

        const button = new Button();
        button.text = "CLOSE MODAL";
        modalPage.content = button;

        (<Button>page.content).showModal(modalPage, {}, modalCloseCallback);
    }

    const masterPageFactory = function(): Page {
        const masterPage = new Page();
        masterPage.id = "masterPage_test_WhenInnerViewCallsCloseModal_WithArguments_ShouldPassResult";
        masterPage.on(Page.navigatedToEvent, hostNavigatedToEventHandler)
        
        const button = new Button();
        button.text = "TAP";
        masterPage.content = button;

        return masterPage;
    };

    helper.navigate(masterPageFactory);

    TKUnit.waitUntilReady(() => modalClosedWithResult);
}

export function test_WhenViewBaseCallsShowModal_WithArguments_ShouldOpenModal() {
    let modalClosed = false;

    const modalCloseCallback = function (returnValue: any) {
        modalClosed = true;
    }

    const createTabItems = function(count: number) {
        var items = new Array<TabViewItem>();

        for (var i = 0; i < count; i++) {
            var label = new Label();
            label.text = "Tab " + i;
            var tabEntry = new TabViewItem();
            tabEntry.title = "Tab " + i;
            tabEntry.view = label;

            items.push(tabEntry);
        }

        return items;
    }

    const modalPageShownModallyEventHandler = function(args: ShownModallyData) {
        const page = <Page>args.object;
        page.off(View.shownModallyEvent, modalPageShownModallyEventHandler);
        args.closeCallback();
    }

    const hostNavigatedToEventHandler = function(args) {
        const page = <Page>args.object;
        page.off(Page.navigatedToEvent, hostNavigatedToEventHandler);

        const modalPage = new Page();
        modalPage.id = "modalPage_test_WhenViewBaseCallsShowModal_WithArguments_ShouldOpenModal";
        modalPage.on(View.shownModallyEvent, modalPageShownModallyEventHandler);
        const tabViewItem = (<TabView>page.content).items[0];
        tabViewItem.showModal(modalPage, {}, modalCloseCallback, false, false);
    }

    const masterPageFactory = function(): Page {
        const masterPage = new Page();
        masterPage.id = "masterPage_test_WhenViewBaseCallsShowModal_WithArguments_ShouldOpenModal";
        masterPage.on(Page.navigatedToEvent, hostNavigatedToEventHandler)
        
        const tabView = new TabView();
        tabView.items = createTabItems(2);
        masterPage.content = tabView;

        return masterPage;
    };

    helper.navigate(masterPageFactory);

    TKUnit.waitUntilReady(() => modalClosed);
}

export function test_WhenViewBaseCallsShowModal_WithoutArguments_ShouldThrow() {
    let navigatedTo = false;

    const createTabItems = function(count: number) {
        var items = new Array<TabViewItem>();

        for (var i = 0; i < count; i++) {
            var label = new Label();
            label.text = "Tab " + i;
            var tabEntry = new TabViewItem();
            tabEntry.title = "Tab " + i;
            tabEntry.view = label;

            items.push(tabEntry);
        }

        return items;
    }

    const hostNavigatedToEventHandler = function(args) {
        const page = <Page>args.object;
        page.off(Page.navigatedToEvent, hostNavigatedToEventHandler);
     
        const hostPage = <Page>args.object;
        const tabViewItem = (<TabView>page.content).items[0];
        TKUnit.assertThrows(() => tabViewItem.showModal());

        navigatedTo = true;
    }

    const masterPageFactory = function(): Page {
        const masterPage = new Page();
        masterPage.id = "masterPage_test_WhenViewBaseCallsShowModal_WithoutArguments_ShouldThrow";
        masterPage.on(Page.navigatedToEvent, hostNavigatedToEventHandler)
        
        const tabView = new TabView();
        tabView.items = createTabItems(2);
        masterPage.content = tabView;

        return masterPage;
    };

    helper.navigate(masterPageFactory);

    TKUnit.waitUntilReady(() => navigatedTo);
}

export function test_WhenNavigatingForwardAndBack_IsBackNavigationIsCorrect() {
    let page1;
    let page2;
    let forwardCounter = 0;
    let backCounter = 0;

    const navigatedEventHandler = (args: NavigatedData) => {
        if (args.isBackNavigation) {
            backCounter++;
        } else {
            forwardCounter++;
        }
    }

    const pageFactory1 = function (): Page {
        page1 = new Page();
        page1.id = "page1_test_WhenNavigatingForwardAndBack_IsBackNavigationIsCorrect";
        page1.on(Page.navigatedToEvent, navigatedEventHandler);
        return page1;
    };

    const pageFactory2 = function (): Page {
        page2 = new Page();
        page2.id = "page2_test_WhenNavigatingForwardAndBack_IsBackNavigationIsCorrect";
        page2.on(Page.navigatedToEvent, navigatedEventHandler);
        return page2;
    };

    helper.navigateWithHistory(pageFactory1);
    helper.navigateWithHistory(pageFactory2);

    helper.goBack();

    TKUnit.assertEqual(forwardCounter, 2, "Forward navigation counter should be 2");
    TKUnit.assertEqual(backCounter, 1, "Backward navigation counter should be 1");
    page1.off(Page.navigatedToEvent, navigatedEventHandler);
    page2.off(Page.navigatedToEvent, navigatedEventHandler);

    helper.goBack();
}

export function test_WhenRootTabViewShownModallyItCanCloseModal() {
    let modalClosed = false;

    const modalCloseCallback = function (returnValue: any) {
        modalClosed = true;
    }

    const createTabItems = function(count: number) {
        var items = new Array<TabViewItem>();

        for (var i = 0; i < count; i++) {
            var label = new Label();
            label.text = "Tab " + i;
            var tabEntry = new TabViewItem();
            tabEntry.title = "Tab " + i;
            tabEntry.view = label;

            items.push(tabEntry);
        }

        return items;
    }

    const tabViewShownModallyEventHandler = function(args: ShownModallyData) {
        args.closeCallback("return value");
    }

    const hostNavigatedToEventHandler = function(args) {
        const page = <Page>args.object;
        page.off(Page.navigatedToEvent, hostNavigatedToEventHandler);

        const tabView = new TabView();
        tabView.items = createTabItems(2);
        tabView.on(View.shownModallyEvent, tabViewShownModallyEventHandler);

        page.showModal(tabView, {}, modalCloseCallback, false, false);
    }

    const masterPageFactory = function(): Page {
        const masterPage = new Page();
        masterPage.id = "masterPage_test_WhenRootTabViewShownModallyItCanCloseModal";
        masterPage.on(Page.navigatedToEvent, hostNavigatedToEventHandler);

        const label = new Label();
        label.text = "Text";
        masterPage.content = label;
        return masterPage;
    };

    helper.navigate(masterPageFactory);

    TKUnit.waitUntilReady(() => modalClosed);
}

export function test_WhenPageIsNavigatedToItCanShowAnotherPageAsModal() {
    // if (platform.device.os === platform.platformNames.android
    //     && android.os.Build.VERSION.SDK_INT === android.os.Build.VERSION_CODES.JELLY_BEAN_MR1
    //     && android.os.Build.CPU_ABI.indexOf("x86") !== -1) {
    //     // Skip this test on x68 Android with API Level 17
    //     return;
    // }

    const ctx = {
        shownModally: false
    };

    let masterPage;
    let modalClosed = false;

    const modalCloseCallback = function (returnValue: any) {
        TKUnit.assertTrue(ctx.shownModally, "Modal-page must be shown!");
        TKUnit.assertEqual(returnValue, "return value", "Modal-page must return value!");
        modalClosed = true;
    }

    let modalPage: Page;
    let shownModally = 0;

    const onShownModal = function (args: ShownModallyData) {
        shownModally++;
        modalPage.off(Page.shownModallyEvent, onShownModal);
    }

    let modalLoaded = 0;
    const onModalLoaded = function (args: EventData) {
        modalLoaded++;
        modalPage.off(Page.loadedEvent, onModalLoaded);
    }

    let modalUnloaded = 0;
    const onModalUnloaded = function (args: EventData) {
        modalUnloaded++;
        modalPage.off(Page.unloadedEvent, onModalUnloaded);
        TKUnit.assertNull(masterPage.modal, "currentPage.modal should be undefined when no modal page is shown!");
    }

    const navigatedToEventHandler = function (args) {
        const page = <Page>args.object;
        TKUnit.assertNull(page.modal, "currentPage.modal should be undefined when no modal page is shown!");
        const basePath = "ui/page/";
        const entry: NavigationEntry = {
            moduleName: basePath + "modal-page"
        };

        modalPage = createViewFromEntry(entry) as Page;
        modalPage.on(Page.shownModallyEvent, onShownModal);
        modalPage.on(Page.loadedEvent, onModalLoaded);
        modalPage.on(Page.unloadedEvent, onModalUnloaded);

        page.showModal(modalPage, ctx, modalCloseCallback, false, false);
        TKUnit.assertTrue((<any>modalPage).showingModally, "showingModally");
    };

    const masterPageFactory = function (): Page {
        masterPage = new Page();
        masterPage.id = "masterPage_test_WhenPageIsNavigatedToItCanShowAnotherPageAsModal";
        masterPage.on(Page.navigatedToEvent, navigatedToEventHandler);
        const label = new Label();
        label.text = "Text";
        masterPage.content = label;
        return masterPage;
    };

    helper.navigate(masterPageFactory);

    TKUnit.waitUntilReady(() => modalUnloaded > 0);
    TKUnit.assertEqual(shownModally, 1, "shownModally");
    TKUnit.assertEqual(modalLoaded, 1, "modalLoaded");
    TKUnit.assertEqual(modalUnloaded, 1, "modalUnloaded");

    masterPage.off(Page.navigatedToEvent, navigatedToEventHandler);
}

export function test_WhenModalPageShownHostPageNavigationEventsShouldNotBeRaised() {
    let hostNavigatingToCount = 0;
    let hostNavigatedToCount = 0;
    let hostNavigatingFromCount = 0;
    let hostNavigatedFromCount = 0;

    let ready = false;

    const modalCloseCallback = function (returnValue: any) {
        TKUnit.assertEqual(stack().length, 1, "Single frame should be instantiated at this point!");
        ready = true;
    }

    const hostNavigatingToEventHandler = function () {
        hostNavigatingToCount++;
    };

    const hostNavigatedToEventHandler = function () {
        hostNavigatedToCount++;
    };

    const hostNavigatingFromEventHandler = function () {
        hostNavigatingFromCount++;
    };

    const hostNavigatedFromEventHandler = function () {
        hostNavigatedFromCount++;
    };

    const modalPageShownModallyEventHandler = function() {
        TKUnit.assertEqual(stack().length, 1, "Single frame should be instantiated at this point!");
    }

    const hostNavigatedToEventHandler2 = function(args: NavigatedData) {
        const page = <Page>args.object;
        page.off(Page.navigatedToEvent, hostNavigatedToEventHandler2);

        const basePath = "ui/page/";
        const entry: NavigationEntry = {
            moduleName: basePath + "modal-page"
        };

        TKUnit.assertEqual(stack().length, 1, "Single frame should be instantiated at this point!");

        const modalPage = createViewFromEntry(entry) as Page;
        modalPage.on(Frame.shownModallyEvent, modalPageShownModallyEventHandler);

        page.showModal(modalPage, {}, modalCloseCallback, false, false);
    }
    
    const masterPageFactory = function (): Page {
        const masterPage = new Page();
        masterPage.id = "masterPage_test_WhenModalPageShownHostPageNavigationEventsShouldNotBeRaised";
        masterPage.on(Page.navigatingToEvent, hostNavigatingToEventHandler);
        masterPage.on(Page.navigatedToEvent, hostNavigatedToEventHandler);
        masterPage.on(Page.navigatedToEvent, hostNavigatedToEventHandler2);
        masterPage.on(Page.navigatingFromEvent, hostNavigatingFromEventHandler);
        masterPage.on(Page.navigatedFromEvent, hostNavigatedFromEventHandler);

        const label = new Label();
        label.text = "Text";
        masterPage.content = label;
        return masterPage;
    };

    helper.navigate(masterPageFactory);

    TKUnit.waitUntilReady(() => ready);

    // only raised by the initial navigation to the master page
    TKUnit.assertTrue(hostNavigatingToCount === 1);
    TKUnit.assertTrue(hostNavigatedToCount === 1);

    TKUnit.assertTrue(hostNavigatingFromCount === 0);
    TKUnit.assertTrue(hostNavigatedFromCount === 0);
}

export function test_WhenModalPageShownModalNavigationToEventsShouldBeRaised() {
    let modalNavigatingToCount = 0;
    let modalNavigatedToCount = 0;
    let modalNavigatingFromCount = 0;
    let modalNavigatedFromCount = 0;

    let ready = false;

    const modalCloseCallback = function (returnValue: any) {
        ready = true;
    }

    const modalNavigatingToEventHandler = function () {
        modalNavigatingToCount++;
    };

    const modalNavigatedToEventHandler = function (args: NavigatedData) {
        modalNavigatedToCount++;

        (args.object as View).closeModal();
    };

    const modalNavigatingFromEventHandler = function () {
        modalNavigatingFromCount++;
    };

    const modalNavigatedFromEventHandler = function () {
        modalNavigatedFromCount++;
    };

    const modalFrameShownModallyEventHandler = function(args) {
        const basePath = "ui/page/";
        const entry: NavigationEntry = {
            moduleName: basePath + "modal-page"
        };        
        
        const modalPage = createViewFromEntry(entry) as Page;
        modalPage.on(Page.navigatingToEvent, modalNavigatingToEventHandler);
        modalPage.on(Page.navigatedToEvent, modalNavigatedToEventHandler);
        modalPage.on(Page.navigatingFromEvent, modalNavigatingFromEventHandler);
        modalPage.on(Page.navigatedFromEvent, modalNavigatedFromEventHandler);

        (args.object as Frame).navigate(() => modalPage);
    }

    let modalFrame;

    const hostNavigatedToEventHandler = function(args) {
        const page = <Page>args.object;
        page.off(Page.navigatedToEvent, hostNavigatedToEventHandler);

        modalFrame = new Frame();
        modalFrame.on(Frame.shownModallyEvent, modalFrameShownModallyEventHandler);

        page.showModal(modalFrame, {}, modalCloseCallback, false, false);
    }
    
    const masterPageFactory = function (): Page {
        const masterPage = new Page();
        masterPage.id = "masterPage_test_WhenModalPageShownModalNavigationToEventsShouldBeRaised";
        masterPage.on(Page.navigatedToEvent, hostNavigatedToEventHandler);

        const label = new Label();
        label.text = "Text";
        masterPage.content = label;
        return masterPage;
    };

    helper.navigate(masterPageFactory);

    TKUnit.waitUntilReady(() => ready && !modalFrame.isLoaded);

    // only raised by the initial show modal navigation
    TKUnit.assertTrue(modalNavigatingToCount === 1);
    TKUnit.assertTrue(modalNavigatedToCount === 1);

    TKUnit.assertTrue(modalNavigatingFromCount === 0);
    TKUnit.assertTrue(modalNavigatedFromCount === 0);
}

export function test_WhenModalFrameShownModalEventsRaisedOnRootModalFrame() {
    let showingModallyCount = 0;
    let shownModallyCount = 0;

    let ready = false;

    const modalCloseCallback = function (returnValue: any) {
        TKUnit.assertEqual(stack().length, 1, "Single frame should be instantiated at this point!");
        ready = true;
    }

    const modalFrameShowingModallyEventHandler = function(args: ShownModallyData) {
        showingModallyCount++;
    }

    const modalFrameShownModallyEventHandler = function(args: ShownModallyData) {
        shownModallyCount++;
        TKUnit.assertEqual(stack().length, 2, "Host and modal frame should be instantiated at this point!");

        args.closeCallback("return value");
    }

    let modalFrame;

    const hostNavigatedToEventHandler = function(args) {
        const page = <Page>args.object;
        page.off(Page.navigatedToEvent, hostNavigatedToEventHandler);

        const basePath = "ui/page/";
        const entry: NavigationEntry = {
            moduleName: basePath + "modal-page"
        };

        const modalPage = createViewFromEntry(entry) as Page;

        TKUnit.assertEqual(stack().length, 1, "Single frame should be instantiated at this point!");

        modalFrame = new Frame();
        modalFrame.on(Frame.showingModallyEvent, modalFrameShowingModallyEventHandler);
        modalFrame.on(Frame.shownModallyEvent, modalFrameShownModallyEventHandler);
        modalFrame.navigate(() => modalPage);

        TKUnit.assertEqual(stack().length, 2, "Host and modal frame should be instantiated at this point!");

        page.showModal(modalFrame, {}, modalCloseCallback, false, false);
    }
    
    const masterPageFactory = function (): Page {
        const masterPage = new Page();
        masterPage.id = "masterPage_test_WhenModalFrameShownModalEventsRaisedOnRootModalFrame";
        masterPage.on(Page.navigatedToEvent, hostNavigatedToEventHandler);

        const label = new Label();
        label.text = "Text";
        masterPage.content = label;
        return masterPage;
    };

    helper.navigate(masterPageFactory);

    TKUnit.waitUntilReady(() => ready && !modalFrame.isLoaded);

    TKUnit.assertTrue(showingModallyCount === 1);
    TKUnit.assertTrue(shownModallyCount === 1);
}

export function test_WhenModalPageShownShowModalEventsRaisedOnRootModalPage() {
    let showingModallyCount = 0;
    let shownModallyCount = 0;

    let ready = false;

    const modalCloseCallback = function (returnValue: any) {
        ready = true;
    }

    const modalPageShowingModallyEventHandler = function(args: ShownModallyData) {
        showingModallyCount++;
    }

    const modalPageShownModallyEventHandler = function(args: ShownModallyData) {
        shownModallyCount++;

        setTimeout(() => {
            args.closeCallback("return value");
        }, 0);
    }

    const hostNavigatedToEventHandler = function(args) {
        const page = <Page>args.object;
        page.off(Page.navigatedToEvent, hostNavigatedToEventHandler);

        const basePath = "ui/page/";
        const entry: NavigationEntry = {
            moduleName: basePath + "modal-page"
        };

        const modalPage = createViewFromEntry(entry) as Page;
        modalPage.on(Page.showingModallyEvent, modalPageShowingModallyEventHandler);
        modalPage.on(Page.shownModallyEvent, modalPageShownModallyEventHandler);

        page.showModal(modalPage, {}, modalCloseCallback, false, false);
    }
    
    const masterPageFactory = function (): Page {
        const masterPage = new Page();
        masterPage.id = "masterPage_test_WhenModalPageShownShowModalEventsRaisedOnRootModalPage";
        masterPage.on(Page.navigatedToEvent, hostNavigatedToEventHandler);

        const label = new Label();
        label.text = "Text";
        masterPage.content = label;
        return masterPage;
    };

    helper.navigate(masterPageFactory);

    TKUnit.waitUntilReady(() => ready);

    TKUnit.assertTrue(showingModallyCount === 1);
    TKUnit.assertTrue(shownModallyCount === 1);
}

export function test_WhenModalPageShownShowModalEventsRaisedOnRootModalTabView() {
    let showingModallyCount = 0;
    let shownModallyCount = 0;

    let ready = false;

    const modalCloseCallback = function (returnValue: any) {
        TKUnit.assertEqual(stack().length, 1, "Single host frame should be instantiated at this point!");

        ready = true;
    }

    const modalTabViewShowingModallyEventHandler = function(args: ShownModallyData) {
        showingModallyCount++;
    }

    const modalTabViewShownModallyEventHandler = function(args: ShownModallyData) {
        shownModallyCount++;
    }
    
    const hostNavigatedToEventHandler = function(args) {
        const page = <Page>args.object;
        page.off(Page.navigatedToEvent, hostNavigatedToEventHandler);

        const basePath = "ui/page/";
        const entry: NavigationEntry = {
            moduleName: basePath + "modal-tab-root"
        };

        TKUnit.assertEqual(stack().length, 1, "Single host frame should be instantiated at this point!");

        const modalTabView = createViewFromEntry(entry) as TabView;
        modalTabView.on(TabView.showingModallyEvent, modalTabViewShowingModallyEventHandler);
        modalTabView.on(TabView.shownModallyEvent, modalTabViewShownModallyEventHandler);

        TKUnit.assertEqual(stack().length, 2, "Host and tab modal frame should be instantiated at this point!");

        page.showModal(modalTabView, { }, modalCloseCallback, false, false);
    }

    const masterPageFactory = function (): Page {
        const masterPage = new Page();
        masterPage.id = "masterPage_test_WhenModalPageShownShowModalEventsRaisedOnRootModalTabView";
        masterPage.on(Page.navigatedToEvent, hostNavigatedToEventHandler);

        const label = new Label();
        label.text = "Text";
        masterPage.content = label;
        return masterPage;
    };

    TKUnit.assertEqual(stack().length, 1, "Single host frame should be instantiated at this point!");

    helper.navigate(masterPageFactory);

    TKUnit.assertEqual(stack().length, 2, "Host and modal tab frame should be instantiated at this point!");

    TKUnit.waitUntilReady(() => ready);

    TKUnit.assertEqual(stack().length, 1, "Single host frame should be instantiated at this point!");

    TKUnit.assertTrue(showingModallyCount === 1);
    TKUnit.assertTrue(shownModallyCount === 1);
}

export function test_percent_width_and_height_support() {
    const testPage = new Page();
    testPage.id = "test_percent_width_and_height_support";

    const stackLayout = new StackLayout();
    (<any>stackLayout).width = "50%";
    (<any>stackLayout).height = "50%";

    testPage.content = stackLayout;

    const pageWidth = testPage.getMeasuredWidth();
    const pageHeight = testPage.getMeasuredHeight()

    TKUnit.assertEqual(pageWidth, Math.round(pageWidth / 2), "Current page MeasuredWidth incorrect");
    TKUnit.assertEqual(pageHeight, Math.round(pageHeight / 2), "Current page MeasuredHeight incorrect");

    //reset values.
    testPage.style.height = unsetValue;
    testPage.style.width = unsetValue;

    TKUnit.assertTrue(PercentLength.equals(testPage.width, "auto"));
    TKUnit.assertTrue(PercentLength.equals(testPage.height, "auto"));
}

export function test_percent_margin_support() {
    const testPage = new Page();
    const gridLayout = new GridLayout();
    const stackLayout = new StackLayout();
    stackLayout.margin = "10%";
    gridLayout.addChild(stackLayout);
    testPage.content = gridLayout;

    helper.navigate(() => testPage);

    const parentBounds = gridLayout._getCurrentLayoutBounds();
    const parentWidth = parentBounds.right - parentBounds.left;
    const parentHeight = parentBounds.bottom - parentBounds.top;

    const marginLeft = isIOS ? Math.round(parentWidth * 0.1) : Math.floor(parentWidth * 0.1);
    const marginTop = isIOS ? Math.round(parentHeight * 0.1) : Math.floor(parentHeight * 0.1);

    let bounds = stackLayout._getCurrentLayoutBounds();
    TKUnit.assertEqual(Math.round(bounds.left), marginLeft, "Stack LEFT position incorrect");
    TKUnit.assertEqual(Math.round(bounds.top), marginTop, "Stack TOP position incorrect");
    TKUnit.assertEqual(Math.round(bounds.bottom - bounds.top), parentHeight - (2 * marginTop), "Stack HEIGHT incorrect");
    TKUnit.assertEqual(Math.round(bounds.right - bounds.left), parentWidth - (2 * marginLeft), "Stack WIDTH incorrect");
    TKUnit.assertEqual(Math.round(bounds.right), parentWidth - marginLeft, "Stack RIGHT position incorrect");
    TKUnit.assertEqual(Math.round(bounds.bottom), parentHeight - marginTop, "Stack BOTTOM position incorrect");

    //reset values.
    stackLayout.margin = "0";
    TKUnit.waitUntilReady(() => stackLayout.isLayoutValid);

    bounds = stackLayout._getCurrentLayoutBounds();
    TKUnit.assertEqual(bounds.left, 0, "Stack LEFT position incorrect");
    TKUnit.assertEqual(bounds.top, 0, "Stack TOP position incorrect");
    TKUnit.assertEqual(bounds.bottom - bounds.top, parentHeight, "Stack HEIGHT incorrect");
    TKUnit.assertEqual(bounds.right - bounds.left, parentWidth, "Stack WIDTH incorrect");
    TKUnit.assertEqual(bounds.right, parentWidth, "Stack RIGHT position incorrect");
    TKUnit.assertEqual(bounds.bottom, parentHeight, "Stack BOTTOM position incorrect");
}
