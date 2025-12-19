/**
 * Call a JSON-in JSON-out API endpoint
 * Data is automatically serialized
 * @param {string} endpoint - The API endpoint to call
 * @param {any} data - The data to send to the API
 * @returns {Promise<any>} The JSON response from the API
 */
export async function callJsonApi(endpoint, data) {
  const response = await fetchApi(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let error = await response.text();
    try {
      const errorJson = JSON.parse(error);
      if (errorJson.error) error = errorJson.error;
      else if (errorJson.message) error = errorJson.message;
    } catch (e) {
      // ignore, use raw text
    }
    throw new Error(error);
  }

  // Check for empty response
  const contentLength = response.headers.get("Content-Length");
  if (response.status === 204 || contentLength === "0") {
    return null;
  }

  // Check content type before parsing as JSON
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
      // If not JSON, return text or null depending on needs, 
      // but for callJsonApi implies JSON expected. 
      // However, sometimes APIs return text for success.
      // Let's try to peek.
      const text = await response.text();
      try {
          return JSON.parse(text);
      } catch (e) {
          // If it's not JSON, return the text content if it exists
          return text || null; 
      }
  }

  const jsonResponse = await response.json();
  return jsonResponse;
}

/**
 * Fetch wrapper for A0 APIs that ensures token exchange
 * Automatically adds CSRF token to request headers
 * @param {string} url - The URL to fetch
 * @param {Object} [request] - The fetch request options
 * @returns {Promise<Response>} The fetch response
 */
export async function fetchApi(url, request) {
  async function _wrap(retry) {
    // get the CSRF token
    const token = await getCsrfToken();

    // create a new request object if none was provided
    const finalRequest = request || {};

    // ensure headers object exists
    finalRequest.headers = finalRequest.headers || {};

    // add the CSRF token to the headers
    finalRequest.headers["X-CSRF-Token"] = token;

    // perform the fetch with the updated request
    const response = await fetch(url, finalRequest);

    // check if there was an CSRF error
    if (response.status === 403 && retry) {
      // retry the request with new token
      csrfToken = null;
      return await _wrap(false);
    } else if (response.redirected && response.url.endsWith("/login")) {
      // redirect to login
      window.location.href = response.url;
      return;
    }

    // return the response
    return response;
  }

  // perform the request
  const response = await _wrap(true);

  // return the response
  return response;
}

// csrf token stored locally
let csrfToken = null;

/**
 * Get the CSRF token for API requests
 * Caches the token after first request
 * @returns {Promise<string>} The CSRF token
 */
async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch("/csrf_token", {
    credentials: "same-origin",
  });
  if (response.redirected && response.url.endsWith("/login")) {
    // redirect to login
    window.location.href = response.url;
    return;
  }
  let json;
  try {
    const text = await response.text();
    json = JSON.parse(text);
  } catch (e) {
    throw new Error("Failed to parse CSRF token response: " + e.message);
  }
  
  if (json.ok) {
    csrfToken = json.token;
    document.cookie = `csrf_token_${json.runtime_id}=${csrfToken}; SameSite=Strict; Path=/`;
    return csrfToken;
  } else {
    if (json.error) alert(json.error);
    throw new Error(json.error || "Failed to get CSRF token");
  }
}
