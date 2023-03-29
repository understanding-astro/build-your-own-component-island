/**
 * Define a MiniIsland class to encapsulate the behavior of 
our custom element, <mini-island>
 * This class extends HTMLElement where the HTMLElement 
interface represents any HTML element.
 */
class MiniIsland extends HTMLElement {
  /**
   * Define the name for the custom element as a static class 
property.
   * Custom element names require a dash to be used in them 
(kebab-case).
   * The name can't be a single word. ✅ mini-island ❌ 
miniIsland
   */
  static tagName = "mini-island";
  static attributes = {
    dataIsland: "data-island",
  };

  /**
   * The connectedCallback is a part of the custom elements lifecycle callback.
   * It is invoked anytime the custom element is attached to the DOM
   */
  async connectedCallback() {
    /**
     * As soon as the island is connected, we will go ahead and hydrate the island
     */
    await this.hydrate();
  }

  getTemplates() {
    /**
     * querySelectorAll() returns a list of the document's elements that match the specified group of selectors.
     * The selector in this case is of the form "template[data-island]"
     * i.e., this.querySelectorAll("template[data-island]")
     */
    return this.querySelectorAll(
      `template[${MiniIsland.attributes.dataIsland}]`
    );
  }

  replaceTemplates(templates) {
    /**
     * Iterate over all nodes in the template list.
     * templates refer to a NodeList of templates
     * node refers to a single <template>
     */
    for (const node of templates) {
      /**
       * Grab the HTML content within each <template>
       */
      let html = node.innerHTML;
      /**
       * replace the <template> with its HTML content
       * e.g., <template><p>Hello</p></template> becomes <p>Hello</p>
       */
      node.replaceWith(node.content);
    }
  }

  async hydrate() {
    /**
     * conditions will hold an array of potential condition promises
     * to be resolved before hydration
     */
    const conditions = [];

    /**
     * Get the condition - attribute value map
     * NB: the argument passed to `Conditions.getConditions` is the island node
     */
    const conditionAttributesMap = Conditions.getConditions(this);

    /**
     * Loop over the conditionAttributesMap variable
     */
    for (const condition in conditionAttributesMap) {
      /**
       * Grab the condition function from the static Conditions map
       * Remember that this refers to a function that returns a promise when invoked
       */

      const conditionFn = Conditions.map[condition];

      /**
       * Check if the condition function exists
       */
      if (conditionFn) {
        /**
         * Invoke the condition function with two arguments:
         * (1) The value of the condition attribute set on the node e.g.,
         * for <mini-island client:visible /> this is an empty string ""
         * for <mini-island client:media="(max-width: 400px)" />
         * this is the string "(max-width: 400px)"
         *
         * (2) The node i.e., the island DOM node
         */
        const conditionPromise = conditionFn(
          conditionAttributesMap[condition],
          this
        );

        /**
         * append the promise to the conditions array
         */

        conditions.push(conditionPromise);
      }

      /**
       * Await all promise conditions to be resolved before replacing the template nodes
       */
      await Promise.all(conditions);
      /**
       * Retrieve the relevant <template> child elements of the island
       */
      const relevantChildTemplates = this.getTemplates();
      /**
       * Grab the DOM subtree the template holds and replace the template with live content
       */
      this.replaceTemplates(relevantChildTemplates);
    }
  }
}

class Conditions {
  /**
   * A map of loading conditions to their respective promises
   */
  static map = {
    idle: Conditions.waitForIdle,
    visible: Conditions.waitForVisible,
    media: Conditions.waitForMedia,
  };

  static getConditions(node) {
    /**
     * The result variable will hold key - value representing condition - attribute value
     * e.g., For <mini-island client:visible>
     * result should be { visible: "" }
     * and for <mini-island client:media="(max-width: 400px)" />
     * result should be { media: "(max-width: 400px)" }
     */
    let result = {};

    /**
     * Loop over all keys of the static map i.e., ["idle", "visible", "media"]
     */
    for (const condition of Object.keys(Conditions.map)) {
      /**
       * Check if the node has attribute of form "client:${key}"
       */
      if (node.hasAttribute(`client:${condition}`)) {
        /**
         * If node has attribute...
         * save the condition (key) - attribute (value) to the result object
         */
        result[condition] = node.getAttribute(`client:${condition}`);
      }
    }

    return result;
  }

  static hasConditions(node) {
    /**
     * Using the "getConditions" static class method, retrieve
     * a conditions attributes map
     */
    const conditionAttributesMap = Conditions.getConditions(node);

    /**
     * Check the length of the result keys to determine if there are
     * any loading conditions on the node
     */
    return Object.keys(conditionAttributesMap).length > 0;
  }

  static waitForIdle() {
    const onLoad = new Promise((resolve) => {
      /**
       * The document.readyState property describes the loading state of the document.
       */
      if (document.readyState !== "complete") {
        /**
         * Set up an event listener for the "load" event.
         * The load event is fired when the whole page has loaded, including all dependent resources such as stylesheets, scripts, iframes, and images
         */
        window.addEventListener(
          "load",
          () => {
            /**
             * resolve this promise once the "load" event is fired
             */
            resolve();
          },
          /**
           * This will remove the listener after the first invocation of the "load" event
           */
          { once: true }
        );
      } else {
        resolve();
      }
    });

    /**
     * The window.requestIdleCallback() method queues a function to be called during a browser's idle periods. This enables developers to perform background and low priority work on the main event loop
     */

    const onIdle = new Promise((resolve) => {
      /**
       * Check for "requestIdleCallback" support
       */
      if ("requestIdleCallback" in window) {
        requestIdleCallback(() => {
          /**
           *pass the promise resolve function as the operation to be queued
           */
          resolve();
        });
      } else {
        /**
         * resolve the promise immediately if requestIdleCallback isn't supported
         */
        resolve();
      }
    });

    /**
     * waitForIdle will wait for both promises to be resolved i.e., onIdle and onLoad
     */
    return Promise.all([onIdle, onLoad]);
  }

  /**
   *
   * @param noop - the value of the condition attribute.
   * This is named "noop" as it is not relevant in this condition i.e.,
   * as per our API, client:visible always has a falsy attribute value e.g.,
   * ✅ <mini-island client:visible />
   * ❌ <mini-island client:visible={some-value} />
   * @param el - the node element.
   * This represents our island DOM node passed during hydration
   * @returns - a Promise that resolves when "el" is visible
   * NB: relies on the Intersection Observer API
   */
  static waitForVisible(noop, el) {
    /**
     * If the Intersection Observer API is not available,
     * go ahead and exit immediately.
     */
    if (!("IntersectionObserver" in window)) {
      return;
    }

    /**
     * Otherwise, set up a new Promise that is resolved when the
     * node parameter (our island DOM node) is visible
     */
    return new Promise((resolve) => {
      let observer = new IntersectionObserver((entries) => {
        let [entry] = entries;

        /**
         * is visible?
         */
        if (entry.isIntersecting) {
          /**
           * remove observer
           */
          observer.unobserve(entry.target);
          /**
           * resolve promise
           */
          resolve();
        }
      });

      /**
       * set up the observer on the "el" argument
       */
      observer.observe(el);
    });
  }

  /**
   *
   * @param {*} query - the query string passed to the client:media attribute
   * @returns Promise that resolves when the document matches the passed CSS media query
   */
  static waitForMedia(query) {
    /**
     * window.matchMedia(query) returns A MediaQueryList object.
     * This object stores information on a media query applied to a document and
     * one of the properties on this object is "matches" - a boolean for whether
     * the document matches the media query or not.
     * Create a new simple object of similar form i.e., with a "matches" property
     */
    let queryList = {
      matches: true,
    };

    if (query && "matchMedia" in window) {
      queryList = window.matchMedia(query);
    }

    /**
     * If matchMedia isn't supported or query is falsy, return immediately
     */
    if (queryList.matches) {
      return;
    }

    return new Promise((resolve) => {
      /**
       * Set a new listener on the queryList object
       * and resolve the promise when there's a match
       */
      queryList.addListener((e) => {
        if (e.matches) {
          resolve();
        }
      });
    });
  }
}

/**
 * Our solution relies heavily on web components. Check that the
 * browser supports web components via the 'customElements' property
 */

if ("customElements" in window) {
  /**
   * Register our custom element on the CustomElementRegistry object using the define method.
   *
   * NB: The CustomElementRegistry interface provides methods for registering custom elements and querying registered elements.
   *
   * NB: The arguments to the define method are the name of the custom element (mini-island)
   * and the class (MiniIsland) that defines the behaviour of the custom element.
   *
   * NB: "Island.tagName" below represents the static class property i.e., "static tagName".
   */
  window.customElements.define(MiniIsland.tagName, MiniIsland);
} else {
  /**
   * custom elements not supported, log an error to the console
   */
  console.error(
    "Island cannot be initiated because Window.customElements is unavailable"
  );
}
