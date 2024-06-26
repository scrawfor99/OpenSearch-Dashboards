/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 * Any modifications Copyright OpenSearch Contributors. See
 * GitHub history for details.
 */

/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { UnregisterCallback } from 'history';
import {
  InternalApplicationSetup,
  InternalApplicationStart,
  AppNavLinkStatus,
  AppMountParameters,
} from '../application';
import type { HttpSetup, HttpStart } from '../http';
import type { CoreContext } from '../core_system';
import type { NotificationsSetup, NotificationsStart } from '../notifications';
import type { IUiSettingsClient } from '../ui_settings';
import type { InjectedMetadataSetup } from '../injected_metadata';
import { renderApp as renderErrorApp, setupUrlOverflowDetection } from './errors';
import { renderApp as renderStatusApp } from './status';

export interface SetupDeps {
  application: InternalApplicationSetup;
  http: HttpSetup;
  injectedMetadata: InjectedMetadataSetup;
  notifications: NotificationsSetup;
}

export interface StartDeps {
  application: InternalApplicationStart;
  http: HttpStart;
  notifications: NotificationsStart;
  uiSettings: IUiSettingsClient;
}

export class CoreApp {
  private stopHistoryListening?: UnregisterCallback;

  constructor(private readonly coreContext: CoreContext) {}

  public setup({ http, application, injectedMetadata, notifications }: SetupDeps) {
    application.register(this.coreContext.coreId, {
      id: 'error',
      title: 'App Error',
      navLinkStatus: AppNavLinkStatus.hidden,
      mount(params: AppMountParameters) {
        // Do not use an async import here in order to ensure that network failures
        // cannot prevent the error UI from displaying. This UI is tiny so an async
        // import here is probably not useful anyways.
        return renderErrorApp(params, { basePath: http.basePath });
      },
    });

    if (injectedMetadata.getAnonymousStatusPage()) {
      http.anonymousPaths.register('/status');
    }
    application.register(this.coreContext.coreId, {
      id: 'status',
      title: 'Server Status',
      appRoute: '/status',
      chromeless: true,
      navLinkStatus: AppNavLinkStatus.hidden,
      mount(params: AppMountParameters) {
        return renderStatusApp(params, { http, notifications });
      },
    });
  }

  public start({ application, http, notifications, uiSettings }: StartDeps) {
    if (!application.history) {
      return;
    }

    this.stopHistoryListening = setupUrlOverflowDetection({
      basePath: http.basePath,
      history: application.history,
      toasts: notifications.toasts,
      uiSettings,
    });
  }

  public stop() {
    if (this.stopHistoryListening) {
      this.stopHistoryListening();
      this.stopHistoryListening = undefined;
    }
  }
}
