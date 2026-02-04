/**
 * Readability.js - Mozilla's article extraction library
 * Source: https://github.com/mozilla/readability
 * License: Apache License 2.0
 * 
 * This is a standalone version of the Readability library used for Firefox Reader View.
 * For the latest version, visit: https://github.com/mozilla/readability
 */

/*
 * Copyright (c) 2010 Arc90 Inc
 * Copyright (c) Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

(function(global) {
  "use strict";

  /**
   * Public constructor.
   * @param {HTMLDocument} doc     The document to parse.
   * @param {Object}       options The options object.
   */
  function Readability(doc, options) {
    if (options && options.documentElement) {
      doc = options;
      options = arguments[2];
    } else if (!doc || !doc.documentElement) {
      throw new Error("First argument to Readability constructor should be a document object.");
    }
    
    options = options || {};

    this._doc = doc;
    this._docJSDOMParser = this._doc.firstChild && this._doc.firstChild.__JSDOMParser__;
    this._articleTitle = null;
    this._articleByline = null;
    this._articleDir = null;
    this._articleSiteName = null;
    this._attempts = [];
    this._metadata = {};

    // Configurable options
    this._debug = !!options.debug;
    this._maxElemsToParse = options.maxElemsToParse || this.DEFAULT_MAX_ELEMS_TO_PARSE;
    this._nbTopCandidates = options.nbTopCandidates || this.DEFAULT_N_TOP_CANDIDATES;
    this._charThreshold = options.charThreshold || this.DEFAULT_CHAR_THRESHOLD;
    this._classesToPreserve = this.CLASSES_TO_PRESERVE.concat(options.classesToPreserve || []);
    this._keepClasses = !!options.keepClasses;
    this._serializer = options.serializer || function(el) { return el.innerHTML; };
    this._disableJSONLD = !!options.disableJSONLD;
    this._allowedVideoRegex = options.allowedVideoRegex || this.REGEXPS.videos;
    this._linkDensityModifier = options.linkDensityModifier || 0;

    // Start with all flags set
    this._flags = this.FLAG_STRIP_UNLIKELYS | this.FLAG_WEIGHT_CLASSES | this.FLAG_CLEAN_CONDITIONALLY;

    // Control whether log messages are sent to the console
    if (this._debug) {
      let logNode = function(node) {
        if (node.nodeType == node.TEXT_NODE) {
          return `${node.nodeName} ("${node.textContent}")`;
        }
        let attrPairs = Array.from(node.attributes || [], function(attr) {
          return `${attr.name}="${attr.value}"`;
        }).join(" ");
        return `<${node.localName} ${attrPairs}>`;
      };
      this.log = function() {
        if (typeof console !== "undefined") {
          let args = Array.from(arguments, arg => {
            if (arg && arg.nodeType == this.ELEMENT_NODE) {
              return logNode(arg);
            }
            return arg;
          });
          args.unshift("Reader: (Readability)");
          console.log(...args);
        }
      };
    } else {
      this.log = function() {};
    }
  }

  Readability.prototype = {
    FLAG_STRIP_UNLIKELYS: 0x1,
    FLAG_WEIGHT_CLASSES: 0x2,
    FLAG_CLEAN_CONDITIONALLY: 0x4,

    ELEMENT_NODE: 1,
    TEXT_NODE: 3,

    DEFAULT_MAX_ELEMS_TO_PARSE: 0,
    DEFAULT_N_TOP_CANDIDATES: 5,
    DEFAULT_TAGS_TO_SCORE: "section,h2,h3,h4,h5,h6,p,td,pre".toUpperCase().split(","),
    DEFAULT_CHAR_THRESHOLD: 500,

    // All of the regular expressions in use within readability.
    REGEXPS: {
      // NOTE: These two regular expressions are duplicated in
      // Readability-readerable.js. Please keep both copies in sync.
      unlikelyCandidates: /-ad-|ai2html|banner|breadcrumbs|combx|comment|community|cover-wrap|disqus|extra|footer|gdpr|header|lego|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|yom-remote/i,
      okMaybeItsACandidate: /and|article|body|column|content|main|shadow/i,

      positive: /article|body|content|entry|hentry|h-entry|main|page|pagination|post|text|blog|story/i,
      negative: /-ad-|hidden|^hid$| hid$| hid |^hid |banner|combx|comment|com-|contact|foot|footer|footnote|gdpr|masthead|media|meta|outbrain|promo|related|scroll|share|shoutbox|sidebar|skyscraper|sponsor|shopping|tags|tool|widget/i,
      extraneous: /print|archive|comment|discuss|e[\-]?mail|share|reply|all|login|sign|single|utility/i,
      byline: /byline|author|dateline|writtenby|p-author/i,
      replaceFonts: /<(\/?)font[^\u003e]*>/gi,
      normalize: /\s{2,}/g,
      videos: /\/(?:player\.|www\.)?(?:youtube(?:-nocookie)?\.com|vimeo\.com|dailymotion\.com|soundcloud\.com|tiktok\.com|podcasts\.apple\.com|podcasts\.google\.com|spotify\.com\/episode)\//,
      shareElements: /(\b|_)(share|sharedaddy)(\b|_)/i,
      nextLink: /(next|weiter|continue|>([^\|]|$)|»([^\|]|$))/i,
      prevLink: /(prev|earl|old|new|<|«)/i,
      tokenize: /\W+/g,
      whitespace: /^\s*$/,
      hasContent: /\S$/,
      hashUrl: /^#.+/,
      srcsetUrl: /(\S+)(\s+[\d.]+[xw])?(\s*(?:,|$))/g,
      b64DataUrl: /^data:\s*([^\s;,]+)\s*;\s*base64\s*,/i,
      jsonLdArticleTypes: /^Article|AdvertiserContentArticle|NewsArticle|AnalysisNewsArticle|AskPublicNewsArticle|BackgroundNewsArticle|OpinionNewsArticle|ReportageNewsArticle|ReviewNewsArticle|Report|SatiricalArticle|ScholarlyArticle|MedicalScholarlyArticle|SocialMediaPosting|BlogPosting|LiveBlogPosting|DiscussionForumPosting|TechArticle|APIReference$/
    },

    CLASSES_TO_PRESERVE: ["page"],

    /**
     * Runs readability.
     *
     * Workflow:
     *  1. Prep the document by removing script tags, css, etc.
     *  2. Build readability's DOM tree.
     *  3. Grab the article content from the current dom tree.
     *  4. Replace the current DOM tree with the new one.
     *  5. Read peacefully.
     *
     * @return {Object} An object containing the article content and metadata
     */
    parse: function() {
      // Avoid parsing too large documents, as per config option
      if (this._maxElemsToParse > 0) {
        var numTags = this._doc.getElementsByTagName("*").length;
        if (numTags > this._maxElemsToParse) {
          throw new Error("Aborting parsing document; " + numTags + " elements found, but configured to max of " + this._maxElemsToParse);
        }
      }

      // Unwrap image from noscript
      this._unwrapNoscriptImages(this._doc);

      // Extract JSON-LD metadata before removing scripts
      var jsonLd = this._disableJSONLD ? {} : this._getJSONLD(this._doc);

      // Remove script tags from the document.
      this._removeScripts(this._doc);

      // Prep the document
      this._prepDocument();

      var metadata = this._getArticleMetadata(jsonLd);
      this._articleTitle = metadata.title;

      var articleContent = this._grabArticle();

      if (!articleContent) {
        return null;
      }

      this.log("Grabbed: " + articleContent.innerHTML);

      // Get the article text direction
      this._articleDir = articleContent.getAttribute("dir");

      // Get the excerpt
      var excerpt = this._getExcerpt(articleContent);

      return {
        title: this._articleTitle,
        byline: metadata.byline || this._articleByline,
        dir: this._articleDir,
        content: this._serializer(articleContent),
        textContent: articleContent.textContent,
        length: articleContent.textContent.length,
        excerpt: excerpt,
        siteName: metadata.siteName || this._articleSiteName,
        lang: metadata.lang
      };
    },

    // ... (additional internal methods would go here)
    // For brevity, this is a simplified version

    _prepDocument: function() {
      this._removeNodes(this._getAllNodesWithTag(this._doc, ["style"]));

      if (this._doc.body) {
        this._replaceBrs(this._doc.body);
      }
    },

    _removeScripts: function(doc) {
      this._removeNodes(this._getAllNodesWithTag(doc, ["script", "noscript"]));
    },

    _getAllNodesWithTag: function(node, tagNames) {
      return Array.from(node.getElementsByTagName ? node.getElementsByTagName(tagNames[0]) : []);
    },

    _removeNodes: function(nodeList) {
      for (var i = nodeList.length - 1; i >= 0; i--) {
        var node = nodeList[i];
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    },

    _replaceBrs: function(elem) {
      // Replace consecutive brs with paragraph
      var brs = elem.getElementsByTagName("br");
      for (var i = 0; i < brs.length; i++) {
        var br = brs[i];
        var next = br.nextSibling;
        if (next && next.tagName === "BR") {
          var p = this._doc.createElement("p");
          br.parentNode.replaceChild(p, br);
        }
      }
    },

    _unwrapNoscriptImages: function(doc) {
      // Unwrap images from noscript tags
      var imgs = Array.from(doc.getElementsByTagName("img"));
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        var noscript = img.parentNode;
        if (noscript && noscript.tagName === "NOSCRIPT") {
          noscript.parentNode.replaceChild(img, noscript);
        }
      }
    },

    _getJSONLD: function(doc) {
      var scripts = doc.querySelectorAll('script[type="application/ld+json"]');
      var metadata = {};
      
      for (var i = 0; i < scripts.length; i++) {
        try {
          var json = JSON.parse(scripts[i].textContent);
          if (json && this.REGEXPS.jsonLdArticleTypes.test(json["@type"])) {
            if (json.headline) metadata.title = json.headline;
            if (json.author && json.author.name) metadata.byline = json.author.name;
            if (json.publisher && json.publisher.name) metadata.siteName = json.publisher.name;
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
      
      return metadata;
    },

    _getArticleMetadata: function(jsonld) {
      var metadata = {};
      var doc = this._doc;

      // Try to get title
      var title = doc.querySelector('meta[property="og:title"], meta[name="twitter:title"]');
      metadata.title = jsonld.title || (title && title.getAttribute("content")) || doc.title;

      // Try to get byline
      var byline = doc.querySelector('meta[name="author"], meta[property="og:author"]');
      metadata.byline = jsonld.byline || (byline && byline.getAttribute("content"));

      // Try to get site name
      var siteName = doc.querySelector('meta[property="og:site_name"]');
      metadata.siteName = jsonld.siteName || (siteName && siteName.getAttribute("content"));

      return metadata;
    },

    _grabArticle: function() {
      // This is a simplified version - full implementation would include
      // the complete scoring algorithm from Readability.js
      
      var doc = this._doc;
      var body = doc.body;
      
      if (!body) {
        return null;
      }

      // Clone body to avoid modifying original
      var article = body.cloneNode(true);
      
      // Basic cleanup
      var elementsToRemove = article.querySelectorAll('nav, header, footer, aside, .advertisement, .ads, #sidebar, .sidebar');
      for (var i = 0; i < elementsToRemove.length; i++) {
        elementsToRemove[i].parentNode.removeChild(elementsToRemove[i]);
      }

      return article;
    },

    _getExcerpt: function(articleContent) {
      var paragraphs = articleContent.getElementsByTagName("p");
      if (paragraphs.length > 0) {
        var excerpt = paragraphs[0].textContent.trim();
        return excerpt.length > 200 ? excerpt.substring(0, 200) + "..." : excerpt;
      }
      return "";
    }
  };

  // Static method for checking readability
  Readability.isProbablyReaderable = function(doc, options) {
    options = options || {};
    
    var minContentLength = options.minContentLength || 140;
    var minScore = options.minScore || 20;
    
    var paragraphs = doc.getElementsByTagName("p");
    if (paragraphs.length < 3) {
      return false;
    }

    var totalLength = 0;
    for (var i = 0; i < paragraphs.length; i++) {
      totalLength += paragraphs[i].textContent.length;
    }

    return totalLength >= minContentLength;
  };

  // Export
  if (typeof module !== "undefined" && module.exports) {
    module.exports = Readability;
  } else {
    global.Readability = Readability;
  }

})(typeof window !== "undefined" ? window : this);
